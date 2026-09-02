import LZString from "lz-string";
import { DATASETS } from "@/constants/datasets";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import type {
	ActivationFn,
	Conv2DLayerConfig,
	DatasetId,
	DenseLayerConfig,
	DropoutLayerConfig,
	FlattenLayerConfig,
	LayerConfig,
	MaxPooling2DLayerConfig,
	OptimizerType,
	RegularizationType,
	TrainingConfig,
} from "@/types";
import { validateArchitecture } from "./architecture-validator";

export interface ShareableState {
	layers: LayerConfig[];
	inputShape: number[];
	datasetId: DatasetId;
	trainingConfig: TrainingConfig;
}

export type SharedConfigHydrationResult = "missing" | "ignored" | "applied";

const SHAREABLE_KEYS = [
	"layers",
	"inputShape",
	"datasetId",
	"trainingConfig",
] as const;

const DATASET_IDS: readonly DatasetId[] = ["mnist", "fashion-mnist", "cifar10"];

const ACTIVATIONS: readonly ActivationFn[] = [
	"relu",
	"sigmoid",
	"tanh",
	"softmax",
	"linear",
	"elu",
	"selu",
	"swish",
];

const OPTIMIZERS: readonly OptimizerType[] = [
	"sgd",
	"adam",
	"rmsprop",
	"adagrad",
];

const REGULARIZATIONS: readonly RegularizationType[] = ["none", "l1", "l2"];

const BATCH_SIZES = [16, 32, 64, 128, 256] as const;
const CONV_KERNEL_SIZES = [3, 5, 7] as const;
const CONV_STRIDES = [1, 2] as const;
const CONV_PADDINGS = ["same", "valid"] as const;
const POOL_SIZES = [2, 3] as const;

const TRAINING_REQUIRED_KEYS = [
	"optimizer",
	"learningRate",
	"batchSize",
	"epochs",
	"validationSplit",
	"regularization",
	"regularizationRate",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

function hasExactKeys(
	value: Record<string, unknown>,
	keys: readonly string[],
): boolean {
	const actual = Object.keys(value);
	if (actual.length !== keys.length) return false;
	const allowed = new Set(keys);
	return actual.every((key) => allowed.has(key));
}

function isOneOf<T extends string | number>(
	value: unknown,
	allowed: readonly T[],
): value is T {
	return (allowed as readonly unknown[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isIntegerInRange(
	value: unknown,
	min: number,
	max: number,
): value is number {
	return (
		typeof value === "number" &&
		Number.isInteger(value) &&
		value >= min &&
		value <= max
	);
}

function isFiniteInRange(
	value: unknown,
	min: number,
	max: number,
): value is number {
	return isFiniteNumber(value) && value >= min && value <= max;
}

function parseLayer(raw: unknown): LayerConfig | null {
	if (!isPlainObject(raw) || typeof raw.type !== "string") return null;

	switch (raw.type) {
		case "dense": {
			if (!hasExactKeys(raw, ["type", "units", "activation"])) return null;
			if (!isIntegerInRange(raw.units, 2, 512)) return null;
			if (!isOneOf(raw.activation, ACTIVATIONS)) return null;
			const layer: DenseLayerConfig = {
				type: "dense",
				units: raw.units,
				activation: raw.activation,
			};
			return layer;
		}
		case "conv2d": {
			if (
				!hasExactKeys(raw, [
					"type",
					"filters",
					"kernelSize",
					"strides",
					"activation",
					"padding",
				])
			) {
				return null;
			}
			if (!isIntegerInRange(raw.filters, 1, 128)) return null;
			if (!isOneOf(raw.kernelSize, CONV_KERNEL_SIZES)) return null;
			if (!isOneOf(raw.strides, CONV_STRIDES)) return null;
			if (!isOneOf(raw.activation, ACTIVATIONS)) return null;
			if (!isOneOf(raw.padding, CONV_PADDINGS)) return null;
			const layer: Conv2DLayerConfig = {
				type: "conv2d",
				filters: raw.filters,
				kernelSize: raw.kernelSize,
				strides: raw.strides,
				activation: raw.activation,
				padding: raw.padding,
			};
			return layer;
		}
		case "maxPooling2d": {
			if (!hasExactKeys(raw, ["type", "poolSize", "strides"])) return null;
			if (!isOneOf(raw.poolSize, POOL_SIZES)) return null;
			if (!isIntegerInRange(raw.strides, 1, 3)) return null;
			const layer: MaxPooling2DLayerConfig = {
				type: "maxPooling2d",
				poolSize: raw.poolSize,
				strides: raw.strides,
			};
			return layer;
		}
		case "flatten": {
			if (!hasExactKeys(raw, ["type"])) return null;
			const layer: FlattenLayerConfig = { type: "flatten" };
			return layer;
		}
		case "dropout": {
			if (!hasExactKeys(raw, ["type", "rate"])) return null;
			if (!isFiniteNumber(raw.rate) || raw.rate <= 0 || raw.rate >= 1) {
				return null;
			}
			const layer: DropoutLayerConfig = { type: "dropout", rate: raw.rate };
			return layer;
		}
		default:
			return null;
	}
}

function parseTrainingConfig(
	raw: unknown,
	datasetId: DatasetId,
): TrainingConfig | null {
	if (!isPlainObject(raw)) return null;
	const keys = Object.keys(raw);
	const allowed = new Set<string>([...TRAINING_REQUIRED_KEYS, "maxTrainSamples"]);
	if (!TRAINING_REQUIRED_KEYS.every((key) => keys.includes(key))) return null;
	if (!keys.every((key) => allowed.has(key))) return null;

	if (!isOneOf(raw.optimizer, OPTIMIZERS)) return null;
	if (!isFiniteInRange(raw.learningRate, 0.0001, 0.1)) return null;
	if (!isOneOf(raw.batchSize, BATCH_SIZES)) return null;
	if (!isIntegerInRange(raw.epochs, 1, 200)) return null;
	if (!isFiniteInRange(raw.validationSplit, 0.1, 0.5)) return null;
	if (!isOneOf(raw.regularization, REGULARIZATIONS)) return null;
	if (!isFiniteInRange(raw.regularizationRate, 0.0001, 0.1)) return null;

	const config: TrainingConfig = {
		optimizer: raw.optimizer,
		learningRate: raw.learningRate,
		batchSize: raw.batchSize,
		epochs: raw.epochs,
		validationSplit: raw.validationSplit,
		regularization: raw.regularization,
		regularizationRate: raw.regularizationRate,
	};

	if (keys.includes("maxTrainSamples")) {
		const trainSize = DATASETS[datasetId]?.trainSize;
		if (
			trainSize === undefined ||
			!isIntegerInRange(raw.maxTrainSamples, 1, trainSize)
		) {
			return null;
		}
		config.maxTrainSamples = raw.maxTrainSamples;
	}

	return config;
}

function parseShareableState(raw: unknown): ShareableState | null {
	if (!isPlainObject(raw) || !hasExactKeys(raw, SHAREABLE_KEYS)) return null;
	if (!isOneOf(raw.datasetId, DATASET_IDS)) return null;

	const dataset = DATASETS[raw.datasetId];
	if (!dataset) return null;

	const expectedShape = dataset.inputShape;
	if (
		!Array.isArray(raw.inputShape) ||
		raw.inputShape.length !== expectedShape.length ||
		raw.inputShape.some((value, index) => value !== expectedShape[index])
	) {
		return null;
	}

	if (
		!Array.isArray(raw.layers) ||
		raw.layers.length < 1 ||
		raw.layers.length > 64
	) {
		return null;
	}

	const layers: LayerConfig[] = [];
	for (const entry of raw.layers) {
		const layer = parseLayer(entry);
		if (!layer) return null;
		layers.push(layer);
	}

	const inputShape = [...expectedShape];
	const architectureIssues = validateArchitecture(layers, inputShape);
	if (architectureIssues.some((issue) => issue.severity === "error")) {
		return null;
	}

	const trainingConfig = parseTrainingConfig(raw.trainingConfig, raw.datasetId);
	if (!trainingConfig) return null;

	return {
		layers,
		inputShape,
		datasetId: raw.datasetId,
		trainingConfig,
	};
}

function canonicalizeLayer(layer: LayerConfig): LayerConfig {
	switch (layer.type) {
		case "dense":
			return {
				type: "dense",
				units: layer.units,
				activation: layer.activation,
			};
		case "conv2d":
			return {
				type: "conv2d",
				filters: layer.filters,
				kernelSize: layer.kernelSize,
				strides: layer.strides,
				activation: layer.activation,
				padding: layer.padding,
			};
		case "maxPooling2d":
			return {
				type: "maxPooling2d",
				poolSize: layer.poolSize,
				strides: layer.strides,
			};
		case "flatten":
			return { type: "flatten" };
		case "dropout":
			return { type: "dropout", rate: layer.rate };
	}
}

function canonicalizeShareableState(state: ShareableState): ShareableState {
	const trainingConfig: TrainingConfig = {
		optimizer: state.trainingConfig.optimizer,
		learningRate: state.trainingConfig.learningRate,
		batchSize: state.trainingConfig.batchSize,
		epochs: state.trainingConfig.epochs,
		validationSplit: state.trainingConfig.validationSplit,
		regularization: state.trainingConfig.regularization,
		regularizationRate: state.trainingConfig.regularizationRate,
	};
	if (state.trainingConfig.maxTrainSamples !== undefined) {
		trainingConfig.maxTrainSamples = state.trainingConfig.maxTrainSamples;
	}
	return {
		layers: state.layers.map(canonicalizeLayer),
		inputShape: [...state.inputShape],
		datasetId: state.datasetId,
		trainingConfig,
	};
}

export function encodeState(state: ShareableState): string {
	return LZString.compressToEncodedURIComponent(
		JSON.stringify(canonicalizeShareableState(state)),
	);
}

export function decodeState(encoded: string): ShareableState | null {
	try {
		const json = LZString.decompressFromEncodedURIComponent(encoded);
		if (!json) return null;
		return parseShareableState(JSON.parse(json));
	} catch {
		return null;
	}
}

export function getHashParam(key: string): string | null {
	if (typeof window === "undefined") return null;
	const hash = window.location.hash.slice(1);
	const params = new URLSearchParams(hash);
	return params.get(key);
}

export function setHashParam(key: string, value: string): void {
	const hash = window.location.hash.slice(1);
	const params = new URLSearchParams(hash);
	params.set(key, value);
	window.location.hash = params.toString();
}

export function hydrateSharedConfigFromHash(): SharedConfigHydrationResult {
	const encoded = getHashParam("config");
	if (encoded === null) return "missing";
	const decoded = decodeState(encoded);
	if (!decoded) return "ignored";
	useArchitectureStore.getState().setLayers(decoded.layers);
	useArchitectureStore.getState().setInputShape(decoded.inputShape);
	useTrainingStore.getState().setDatasetId(decoded.datasetId);
	useTrainingStore.getState().setTrainingConfig(decoded.trainingConfig);
	return "applied";
}
