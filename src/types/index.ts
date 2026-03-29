// === Network Architecture ===

export type LayerType =
	| "dense"
	| "conv2d"
	| "maxPooling2d"
	| "flatten"
	| "dropout";

// Activations supported as string literals by TF.js ActivationIdentifier
export type ActivationFn =
	| "relu"
	| "sigmoid"
	| "tanh"
	| "softmax"
	| "linear"
	| "elu"
	| "selu"
	| "swish";

export interface DenseLayerConfig {
	type: "dense";
	units: number;
	activation: ActivationFn;
}

export interface Conv2DLayerConfig {
	type: "conv2d";
	filters: number;
	kernelSize: number;
	strides: number;
	activation: ActivationFn;
	padding: "same" | "valid";
}

export interface MaxPooling2DLayerConfig {
	type: "maxPooling2d";
	poolSize: number;
	strides: number;
}

export interface FlattenLayerConfig {
	type: "flatten";
}

export interface DropoutLayerConfig {
	type: "dropout";
	rate: number;
}

export type LayerConfig =
	| DenseLayerConfig
	| Conv2DLayerConfig
	| MaxPooling2DLayerConfig
	| FlattenLayerConfig
	| DropoutLayerConfig;

export interface NetworkConfig {
	layers: LayerConfig[];
	inputShape: number[]; // e.g., [28, 28, 1] for MNIST
}

// === Training ===

export type OptimizerType = "sgd" | "adam" | "rmsprop" | "adagrad";

export type RegularizationType = "none" | "l1" | "l2";

export interface TrainingConfig {
	optimizer: OptimizerType;
	learningRate: number;
	batchSize: number;
	epochs: number;
	validationSplit: number; // 0.0 - 1.0
	regularization: RegularizationType;
	regularizationRate: number;
	maxTrainSamples?: number; // overfitting demo: limits training set size
}

export interface WeightSnapshot {
	layerIndex: number;
	layerName: string;
	weights: Float32Array; // flattened weight matrix
	biases: Float32Array;
	shape: number[]; // original weight tensor shape
}

export interface ActivationSnapshot {
	layerIndex: number;
	layerName: string;
	activations: Float32Array; // activations for a sample batch
	shape: number[];
}

export interface TrainingUpdate {
	epoch: number;
	batch: number;
	totalBatches: number;
	trainLoss: number;
	trainAccuracy: number;
	valLoss: number | null; // null during batch updates (only on epoch end)
	valAccuracy: number | null;
	weightSnapshots: WeightSnapshot[];
	activationSnapshots: ActivationSnapshot[] | null; // optional, every N epochs
	elapsedMs: number;
}

// === Worker Messages ===

export interface WorkerStartMessage {
	type: "start";
	networkConfig: NetworkConfig;
	trainingConfig: TrainingConfig;
	datasetId: DatasetId;
	snapshotEveryNBatches: number;
	onUpdate: (update: TrainingUpdate) => void;
}

export interface WorkerControlMessage {
	type: "pause" | "resume" | "stop";
}

export type WorkerInboundMessage = WorkerStartMessage | WorkerControlMessage;

export interface WorkerUpdateMessage {
	type: "update";
	data: TrainingUpdate;
}

export interface WorkerCompleteMessage {
	type: "complete";
	finalMetrics: {
		trainLoss: number;
		trainAccuracy: number;
		valLoss: number;
		valAccuracy: number;
	};
}

export interface WorkerErrorMessage {
	type: "error";
	error: string;
}

export type WorkerOutboundMessage =
	| WorkerUpdateMessage
	| WorkerCompleteMessage
	| WorkerErrorMessage;

// === Datasets ===

export type DatasetId = "mnist" | "fashion-mnist" | "cifar10";

export interface DatasetMeta {
	id: DatasetId;
	name: string;
	description: string;
	inputShape: number[]; // [28, 28, 1] for MNIST
	numClasses: number;
	trainSize: number;
	testSize: number;
	downloadSizeMB: number;
	classLabels: string[];
	baseUrl: string; // base URL for fetching IDX files
}

// === Visualization ===

export interface NetworkLayoutNode {
	layerIndex: number;
	neuronIndex: number;
	x: number;
	y: number;
	activation: number; // current activation value (0-1 range, normalized)
}

export interface NetworkLayoutEdge {
	fromLayer: number;
	fromNeuron: number;
	toLayer: number;
	toNeuron: number;
	weight: number;
}

export interface MetricsHistoryPoint {
	epoch: number;
	trainLoss: number;
	trainAccuracy: number;
	valLoss: number;
	valAccuracy: number;
}

// === Presets ===

export interface NetworkPreset {
	id: string;
	name: string;
	description: string;
	layers: LayerConfig[];
	recommendedDataset: DatasetId;
}
