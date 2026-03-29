import type { TrainingConfig } from "@/types";

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
	optimizer: "adam",
	learningRate: 0.001,
	batchSize: 64,
	epochs: 10,
	validationSplit: 0.2,
	regularization: "none",
	regularizationRate: 0.0001,
};

export const DEFAULT_SNAPSHOT_EVERY_N_BATCHES = 10;

export const DEFAULT_DATASET_ID = "mnist" as const;
