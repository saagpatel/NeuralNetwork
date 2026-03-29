import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
	DEFAULT_DATASET_ID,
	DEFAULT_TRAINING_CONFIG,
} from "@/constants/defaults";
import type {
	DatasetId,
	MetricsHistoryPoint,
	TrainingConfig,
	WeightSnapshot,
} from "@/types";

type TrainingStatus =
	| "idle"
	| "loading"
	| "training"
	| "paused"
	| "complete"
	| "error";

interface TrainingStore {
	status: TrainingStatus;
	currentEpoch: number;
	currentBatch: number;
	totalBatches: number;
	metricsHistory: MetricsHistoryPoint[];
	latestWeights: WeightSnapshot[];
	errorMessage: string | null;
	datasetId: DatasetId;
	trainingConfig: TrainingConfig;
	datasetLoadProgress: number; // 0–1, updated during dataset download

	setStatus(status: TrainingStatus): void;
	setProgress(epoch: number, batch: number, totalBatches: number): void;
	appendMetrics(point: MetricsHistoryPoint): void;
	setWeights(snapshots: WeightSnapshot[]): void;
	setDataset(id: DatasetId): void;
	setError(message: string): void;
	updateTrainingConfig(update: Partial<TrainingConfig>): void;
	setDatasetLoadProgress(progress: number): void;
	reset(): void;
}

const INITIAL_STATE = {
	status: "idle" as TrainingStatus,
	currentEpoch: 0,
	currentBatch: 0,
	totalBatches: 0,
	metricsHistory: [] as MetricsHistoryPoint[],
	latestWeights: [] as WeightSnapshot[],
	errorMessage: null,
	datasetId: DEFAULT_DATASET_ID as DatasetId,
	trainingConfig: DEFAULT_TRAINING_CONFIG,
	datasetLoadProgress: 0,
};

export const useTrainingStore = create<TrainingStore>()(
	devtools(
		(set) => ({
			...INITIAL_STATE,

			setStatus(status) {
				set({ status }, false, "setStatus");
			},

			setProgress(epoch, batch, totalBatches) {
				set(
					{ currentEpoch: epoch, currentBatch: batch, totalBatches },
					false,
					"setProgress",
				);
			},

			appendMetrics(point) {
				set(
					(state) => ({ metricsHistory: [...state.metricsHistory, point] }),
					false,
					"appendMetrics",
				);
			},

			setWeights(snapshots) {
				set({ latestWeights: snapshots }, false, "setWeights");
			},

			setDataset(id) {
				set({ datasetId: id }, false, "setDataset");
			},

			setError(message) {
				set({ status: "error", errorMessage: message }, false, "setError");
			},

			updateTrainingConfig(update) {
				set(
					(state) => ({
						trainingConfig: { ...state.trainingConfig, ...update },
					}),
					false,
					"updateTrainingConfig",
				);
			},

			setDatasetLoadProgress(progress) {
				set({ datasetLoadProgress: progress }, false, "setDatasetLoadProgress");
			},

			reset() {
				set(
					{
						status: "idle",
						currentEpoch: 0,
						currentBatch: 0,
						totalBatches: 0,
						metricsHistory: [],
						latestWeights: [],
						errorMessage: null,
					},
					false,
					"reset",
				);
			},
		}),
		{ name: "training-store" },
	),
);
