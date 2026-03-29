import * as Comlink from "comlink";
import type {
	DatasetId,
	NetworkConfig,
	TrainingConfig,
	TrainingUpdate,
} from "@/types";

interface FinalMetrics {
	trainLoss: number;
	trainAccuracy: number;
	valLoss: number;
	valAccuracy: number;
}

export interface TrainingWorkerAPI {
	start(
		networkConfig: NetworkConfig,
		trainingConfig: TrainingConfig,
		datasetId: DatasetId,
		snapshotEveryNBatches: number,
		onUpdate: (update: TrainingUpdate) => void,
		onComplete: (finalMetrics: FinalMetrics) => void,
		onError: (message: string) => void,
		onLoadProgress: (progress: number) => void,
	): Promise<void>;
	pause(): Promise<void>;
	resume(): Promise<void>;
	stop(): Promise<void>;
}

let _worker: Worker | null = null;
let _api: Comlink.Remote<TrainingWorkerAPI> | null = null;

/**
 * Create (or return existing) the training Web Worker and its Comlink-wrapped API.
 * Call this once, then reuse the returned api across train/pause/resume/stop calls.
 */
export function getTrainingWorker(): {
	worker: Worker;
	api: Comlink.Remote<TrainingWorkerAPI>;
} {
	if (!_worker || !_api) {
		_worker = new Worker(new URL("./training.worker.ts", import.meta.url), {
			type: "module",
		});
		_api = Comlink.wrap<TrainingWorkerAPI>(_worker);
	}
	return { worker: _worker, api: _api };
}

/**
 * Terminate the worker and reset the singleton.
 * Call this when the playground unmounts or user navigates away.
 */
export function terminateTrainingWorker(): void {
	_worker?.terminate();
	_worker = null;
	_api = null;
}
