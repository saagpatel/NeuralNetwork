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

	// Determine URL pattern based on dataset
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
