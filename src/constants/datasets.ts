import type { DatasetMeta } from "@/types";

// Official TF.js tutorial CDN — stable, public, no auth required.
// Override via NEXT_PUBLIC_DATASET_BASE_URL env var for self-hosting.
const DEFAULT_BASE_URL =
	process.env.NEXT_PUBLIC_DATASET_BASE_URL ??
	"https://storage.googleapis.com/tfjs-tutorials";

export const DATASETS: Record<string, DatasetMeta> = {
	mnist: {
		id: "mnist",
		name: "MNIST",
		description: "Handwritten digit recognition (0–9)",
		inputShape: [28, 28, 1],
		numClasses: 10,
		trainSize: 60000,
		testSize: 10000,
		downloadSizeMB: 11,
		classLabels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
		baseUrl: DEFAULT_BASE_URL,
	},
	"fashion-mnist": {
		id: "fashion-mnist",
		name: "Fashion-MNIST",
		description: "Clothing and accessory classification (10 classes)",
		inputShape: [28, 28, 1],
		numClasses: 10,
		trainSize: 60000,
		testSize: 10000,
		downloadSizeMB: 11,
		classLabels: [
			"T-shirt/top",
			"Trouser",
			"Pullover",
			"Dress",
			"Coat",
			"Sandal",
			"Shirt",
			"Sneaker",
			"Bag",
			"Ankle boot",
		],
		baseUrl: DEFAULT_BASE_URL,
	},
	cifar10: {
		id: "cifar10",
		name: "CIFAR-10",
		description: "60,000 32×32 color images, 10 classes",
		inputShape: [32, 32, 3],
		numClasses: 10,
		trainSize: 10000,
		testSize: 2000,
		downloadSizeMB: 30,
		classLabels: [
			"airplane",
			"automobile",
			"bird",
			"cat",
			"deer",
			"dog",
			"frog",
			"horse",
			"ship",
			"truck",
		],
		baseUrl: "", // not used for CIFAR-10 (uses trainUrl/testUrl)
		trainUrl: "/datasets/cifar10/cifar10_train.bin",
		testUrl: "/datasets/cifar10/cifar10_test.bin",
	},
};

export function getDatasetMeta(id: string): DatasetMeta {
	const meta = DATASETS[id];
	if (!meta) throw new Error(`Unknown dataset: ${id}`);
	return meta;
}
