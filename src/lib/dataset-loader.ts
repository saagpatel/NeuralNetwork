import { get, set } from "idb-keyval";
import { getDatasetMeta } from "@/constants/datasets";
import type { DatasetId, DatasetMeta } from "@/types";

export interface DatasetTensors {
	trainImages: Float32Array; // [trainSize × pixels]
	trainLabels: Uint8Array; // [trainSize]
	testImages: Float32Array; // [testSize × pixels]
	testLabels: Uint8Array; // [testSize]
	meta: DatasetMeta;
}

interface CachedDataset {
	trainImages: ArrayBuffer;
	trainLabels: ArrayBuffer;
	testImages: ArrayBuffer;
	testLabels: ArrayBuffer;
}

// IDX magic numbers (big-endian)
const IDX_IMAGES_MAGIC = 0x00000803;
const IDX_LABELS_MAGIC = 0x00000801;

/**
 * Parse an IDX-formatted binary buffer (MNIST/Fashion-MNIST format).
 * Returns raw bytes — caller handles normalization.
 */
export function parseIdxImages(buffer: ArrayBuffer): Uint8Array {
	const view = new DataView(buffer);
	const magic = view.getInt32(0, false); // big-endian
	if (magic !== IDX_IMAGES_MAGIC) {
		throw new Error(
			`Invalid IDX image magic: 0x${magic.toString(16)} (expected 0x${IDX_IMAGES_MAGIC.toString(16)})`,
		);
	}
	const count = view.getInt32(4, false);
	const rows = view.getInt32(8, false);
	const cols = view.getInt32(12, false);
	const dataOffset = 16;
	const expected = count * rows * cols;
	return new Uint8Array(buffer, dataOffset, expected);
}

/**
 * Parse an IDX-formatted label binary buffer.
 */
export function parseIdxLabels(buffer: ArrayBuffer): Uint8Array {
	const view = new DataView(buffer);
	const magic = view.getInt32(0, false); // big-endian
	if (magic !== IDX_LABELS_MAGIC) {
		throw new Error(
			`Invalid IDX label magic: 0x${magic.toString(16)} (expected 0x${IDX_LABELS_MAGIC.toString(16)})`,
		);
	}
	const count = view.getInt32(4, false);
	return new Uint8Array(buffer, 8, count);
}

/**
 * Normalize uint8 image pixels [0, 255] to float32 [0, 1].
 */
export function normalizeImages(raw: Uint8Array): Float32Array {
	const out = new Float32Array(raw.length);
	for (let i = 0; i < raw.length; i++) {
		out[i] = raw[i] / 255;
	}
	return out;
}

function idbKey(id: DatasetId): string {
	return `nnp-dataset-${id}`;
}

/**
 * Fetch a binary file and return an ArrayBuffer.
 * Reports progress via optional callback (0–1).
 */
async function fetchBinary(
	url: string,
	onProgress?: (progress: number) => void,
): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
	}

	const contentLength = response.headers.get("content-length");
	if (!contentLength || !onProgress) {
		return response.arrayBuffer();
	}

	const total = parseInt(contentLength, 10);
	const reader = response.body?.getReader();
	if (!reader) return response.arrayBuffer();

	const chunks: Uint8Array[] = [];
	let received = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		received += value.length;
		onProgress(received / total);
	}

	const combined = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}
	return combined.buffer;
}

/**
 * Parse raw CIFAR-10 binary data (official binary format).
 * Each record: 1 label byte + 3072 pixel bytes in CHW order (R×1024, G×1024, B×1024).
 * Returns xs in HWC layout normalized to [0, 1], ys as one-hot float32.
 */
export function parseCifar10Batches(
	buffer: ArrayBuffer,
	numClasses: number,
): { xs: Float32Array; ys: Float32Array; count: number } {
	const bytes = new Uint8Array(buffer);
	const RECORD_SIZE = 3073; // 1 label + 32×32×3 pixels
	const count = Math.floor(bytes.length / RECORD_SIZE);

	const xs = new Float32Array(count * 32 * 32 * 3);
	const ys = new Float32Array(count * numClasses);

	for (let i = 0; i < count; i++) {
		const offset = i * RECORD_SIZE;
		const label = bytes[offset];

		// CHW → HWC transposition
		for (let h = 0; h < 32; h++) {
			for (let w = 0; w < 32; w++) {
				for (let c = 0; c < 3; c++) {
					const srcIdx = offset + 1 + c * 1024 + h * 32 + w;
					const dstIdx = i * 32 * 32 * 3 + h * 32 * 3 + w * 3 + c;
					xs[dstIdx] = (bytes[srcIdx] ?? 0) / 255;
				}
			}
		}

		// One-hot encode label
		if (label !== undefined && label < numClasses) {
			ys[i * numClasses + label] = 1;
		}
	}

	return { xs, ys, count };
}

/**
 * Load a dataset by ID. Checks IndexedDB cache first.
 * Downloads, parses, and caches on first call.
 */
export async function loadDataset(
	id: DatasetId,
	onProgress?: (stage: string, progress: number) => void,
): Promise<DatasetTensors> {
	const meta = getDatasetMeta(id);

	// Check IndexedDB cache
	const cached = await get<CachedDataset>(idbKey(id));
	if (cached) {
		return {
			trainImages: new Float32Array(cached.trainImages),
			trainLabels: new Uint8Array(cached.trainLabels),
			testImages: new Float32Array(cached.testImages),
			testLabels: new Uint8Array(cached.testLabels),
			meta,
		};
	}

	// CIFAR-10 uses a single combined binary file per split (not IDX format)
	if (id === "cifar10") {
		const trainUrl = meta.trainUrl;
		const testUrl = meta.testUrl;
		if (!trainUrl || !testUrl) {
			throw new Error("CIFAR-10 meta is missing trainUrl/testUrl");
		}

		onProgress?.("Downloading CIFAR-10 train data...", 0);
		const trainResponse = await fetch(trainUrl);
		if (!trainResponse.ok) {
			onProgress?.("Error: CIFAR-10 data files not found", 0);
			throw new Error(
				"CIFAR-10 data files not found. Run: node scripts/prepare-cifar10.js",
			);
		}
		const trainBuf = await trainResponse.arrayBuffer();
		onProgress?.("Downloading CIFAR-10 test data...", 0.5);

		const testResponse = await fetch(testUrl);
		if (!testResponse.ok) {
			onProgress?.("Error: CIFAR-10 data files not found", 0.5);
			throw new Error(
				"CIFAR-10 data files not found. Run: node scripts/prepare-cifar10.js",
			);
		}
		const testBuf = await testResponse.arrayBuffer();

		onProgress?.("Processing...", 0.97);
		const { xs: trainImages, ys: trainOneHot } = parseCifar10Batches(
			trainBuf,
			meta.numClasses,
		);
		const { xs: testImages, ys: testOneHot } = parseCifar10Batches(
			testBuf,
			meta.numClasses,
		);

		// Convert one-hot back to label indices for the Uint8Array API
		const trainLabels = oneHotToLabels(trainOneHot, meta.numClasses);
		const testLabels = oneHotToLabels(testOneHot, meta.numClasses);

		const toCache: CachedDataset = {
			trainImages: (trainImages.buffer as ArrayBuffer).slice(0),
			trainLabels: (trainLabels.buffer as ArrayBuffer).slice(0),
			testImages: (testImages.buffer as ArrayBuffer).slice(0),
			testLabels: (testLabels.buffer as ArrayBuffer).slice(0),
		};
		await set(idbKey(id), toCache);

		onProgress?.("Ready", 1);
		return { trainImages, trainLabels, testImages, testLabels, meta };
	}

	// Determine URL pattern based on dataset (IDX format: MNIST / Fashion-MNIST)
	const urls = getDatasetUrls(meta);

	// Fetch all 4 files
	onProgress?.("Downloading train images...", 0);
	const trainImagesBuf = await fetchBinary(urls.trainImages, (p) =>
		onProgress?.("Downloading train images...", p * 0.4),
	);

	onProgress?.("Downloading train labels...", 0.4);
	const trainLabelsBuf = await fetchBinary(urls.trainLabels);

	onProgress?.("Downloading test images...", 0.5);
	const testImagesBuf = await fetchBinary(urls.testImages, (p) =>
		onProgress?.("Downloading test images...", 0.5 + p * 0.45),
	);

	onProgress?.("Downloading test labels...", 0.95);
	const testLabelsBuf = await fetchBinary(urls.testLabels);

	// Parse IDX format
	onProgress?.("Processing...", 0.97);
	const trainImages = normalizeImages(parseIdxImages(trainImagesBuf));
	const trainLabels = parseIdxLabels(trainLabelsBuf);
	const testImages = normalizeImages(parseIdxImages(testImagesBuf));
	const testLabels = parseIdxLabels(testLabelsBuf);

	// Cache in IndexedDB (cast to ArrayBuffer — these are never SharedArrayBuffers)
	const toCache: CachedDataset = {
		trainImages: (trainImages.buffer as ArrayBuffer).slice(0),
		trainLabels: (trainLabels.buffer as ArrayBuffer).slice(0),
		testImages: (testImages.buffer as ArrayBuffer).slice(0),
		testLabels: (testLabels.buffer as ArrayBuffer).slice(0),
	};
	await set(idbKey(id), toCache);

	onProgress?.("Ready", 1);
	return { trainImages, trainLabels, testImages, testLabels, meta };
}

/**
 * Convert a one-hot Float32Array to a flat Uint8Array of label indices.
 */
function oneHotToLabels(oneHot: Float32Array, numClasses: number): Uint8Array {
	const count = oneHot.length / numClasses;
	const labels = new Uint8Array(count);
	for (let i = 0; i < count; i++) {
		let maxVal = -1;
		let maxIdx = 0;
		for (let c = 0; c < numClasses; c++) {
			const v = oneHot[i * numClasses + c] ?? 0;
			if (v > maxVal) {
				maxVal = v;
				maxIdx = c;
			}
		}
		labels[i] = maxIdx;
	}
	return labels;
}

interface DatasetUrls {
	trainImages: string;
	trainLabels: string;
	testImages: string;
	testLabels: string;
}

function getDatasetUrls(meta: DatasetMeta): DatasetUrls {
	const base = meta.baseUrl;

	switch (meta.id) {
		case "mnist":
			return {
				trainImages: `${base}/mnist_train_images`,
				trainLabels: `${base}/mnist_train_labels`,
				testImages: `${base}/mnist_test_images`,
				testLabels: `${base}/mnist_test_labels`,
			};
		case "fashion-mnist":
			return {
				trainImages: `${base}/fashion_mnist_train_images`,
				trainLabels: `${base}/fashion_mnist_train_labels`,
				testImages: `${base}/fashion_mnist_test_images`,
				testLabels: `${base}/fashion_mnist_test_labels`,
			};
		case "cifar10":
			return {
				trainImages: `${base}/cifar10_train_images`,
				trainLabels: `${base}/cifar10_train_labels`,
				testImages: `${base}/cifar10_test_images`,
				testLabels: `${base}/cifar10_test_labels`,
			};
	}
}
