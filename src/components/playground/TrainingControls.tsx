"use client";

import * as Comlink from "comlink";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { validateArchitecture } from "@/lib/architecture-validator";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import { useUIStore } from "@/stores/ui-store";
import type { TrainingUpdate } from "@/types";
import {
	getTrainingWorker,
	terminateTrainingWorker,
} from "@/workers/training.api";

interface FinalMetrics {
	trainLoss: number;
	trainAccuracy: number;
	valLoss: number;
	valAccuracy: number;
}

export function TrainingControls() {
	const status = useTrainingStore((s) => s.status);
	const currentEpoch = useTrainingStore((s) => s.currentEpoch);
	const currentBatch = useTrainingStore((s) => s.currentBatch);
	const totalBatches = useTrainingStore((s) => s.totalBatches);
	const trainingConfig = useTrainingStore((s) => s.trainingConfig);
	const datasetId = useTrainingStore((s) => s.datasetId);

	const snapshotEveryNBatches = useUIStore((s) => s.snapshotEveryNBatches);
	const overfittingMode = useUIStore((s) => s.overfittingMode);
	const toggleOverfittingMode = useUIStore((s) => s.toggleOverfittingMode);

	const layers = useArchitectureStore((s) => s.layers);
	const inputShape = useArchitectureStore((s) => s.inputShape);

	// Keep callbacks in stable refs so Comlink proxies don't get GC'd
	const onUpdateRef = useRef<(update: TrainingUpdate) => void>(() => undefined);
	const onCompleteRef = useRef<(metrics: FinalMetrics) => void>(
		() => undefined,
	);
	const onErrorRef = useRef<(msg: string) => void>(() => undefined);
	const onLoadProgressRef = useRef<(progress: number) => void>(() => undefined);

	onUpdateRef.current = (update: TrainingUpdate) => {
		const store = useTrainingStore.getState();
		store.setStatus("training");
		store.setProgress(update.epoch, update.batch, update.totalBatches);
		if (update.weightSnapshots.length > 0) {
			store.setWeights(update.weightSnapshots);
		}
		// Append metrics only on epoch-end (valLoss non-null)
		if (update.valLoss !== null) {
			store.appendMetrics({
				epoch: update.epoch,
				trainLoss: update.trainLoss,
				trainAccuracy: update.trainAccuracy,
				valLoss: update.valLoss,
				valAccuracy: update.valAccuracy ?? 0,
			});
		}
		if (update.confusionMatrix) {
			store.setConfusionMatrix(update.confusionMatrix);
		}
	};

	onCompleteRef.current = (metrics: FinalMetrics) => {
		const store = useTrainingStore.getState();
		store.setStatus("complete");
		store.appendMetrics({
			epoch: trainingConfig.epochs - 1,
			trainLoss: metrics.trainLoss,
			trainAccuracy: metrics.trainAccuracy,
			valLoss: metrics.valLoss,
			valAccuracy: metrics.valAccuracy,
		});
	};

	onErrorRef.current = (msg: string) => {
		useTrainingStore.getState().setError(msg);
	};

	onLoadProgressRef.current = (progress: number) => {
		useTrainingStore.getState().setDatasetLoadProgress(progress);
	};

	async function handlePlayPause() {
		if (status === "idle" || status === "complete" || status === "error") {
			const errors = validateArchitecture(layers, inputShape);
			if (errors.some((e) => e.severity === "error")) return;

			const { api } = getTrainingWorker();
			useTrainingStore.getState().setStatus("loading");

			const config = overfittingMode
				? { ...trainingConfig, maxTrainSamples: 500, epochs: 50 }
				: trainingConfig;

			try {
				await api.start(
					{ layers, inputShape },
					config,
					datasetId,
					snapshotEveryNBatches,
					Comlink.proxy(async (u: TrainingUpdate) => {
						onUpdateRef.current(u);
					}),
					Comlink.proxy(async (m: FinalMetrics) => {
						onCompleteRef.current(m);
					}),
					Comlink.proxy(async (msg: string) => {
						onErrorRef.current(msg);
					}),
					Comlink.proxy(async (p: number) => {
						onLoadProgressRef.current(p);
					}),
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				useTrainingStore.getState().setError(msg);
			}
		} else if (status === "training") {
			const { api } = getTrainingWorker();
			await api.pause();
			useTrainingStore.getState().setStatus("paused");
		} else if (status === "paused") {
			const { api } = getTrainingWorker();
			await api.resume();
			useTrainingStore.getState().setStatus("training");
		}
	}

	async function handleReset() {
		if (status === "training" || status === "paused") {
			const { api } = getTrainingWorker();
			await api.stop();
		}
		terminateTrainingWorker();
		useTrainingStore.getState().reset();
	}

	const validationErrors = validateArchitecture(layers, inputShape);
	const hasErrors = validationErrors.some((e) => e.severity === "error");
	const isActive = status === "training" || status === "paused";

	const batchProgress = totalBatches > 0 ? currentBatch / totalBatches : 0;

	const STATUS_LABELS: Record<string, string> = {
		idle: "Ready",
		loading: "Loading…",
		training: "Training",
		paused: "Paused",
		complete: "Complete",
		error: "Error",
	};

	const STATUS_COLORS: Record<string, string> = {
		idle: "text-slate-400",
		loading: "text-blue-400",
		training: "text-green-400",
		paused: "text-yellow-400",
		complete: "text-blue-300",
		error: "text-red-400",
	};

	return (
		<div className="flex items-center gap-4 px-4 py-2 h-14">
			{/* Play/Pause */}
			<Button
				variant="primary"
				size="md"
				disabled={
					hasErrors ||
					status === "loading" ||
					(!isActive && status === "complete" ? false : false)
				}
				onClick={handlePlayPause}
				title={
					status === "training"
						? "Pause training"
						: status === "paused"
							? "Resume training"
							: "Start training"
				}
			>
				{status === "training" ? (
					<>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
							<rect x="2" y="1" width="3" height="10" rx="0.5" />
							<rect x="7" y="1" width="3" height="10" rx="0.5" />
						</svg>
						Pause
					</>
				) : status === "paused" ? (
					<>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
							<path d="M2 1.5l9 4.5-9 4.5V1.5z" />
						</svg>
						Resume
					</>
				) : (
					<>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
							<path d="M2 1.5l9 4.5-9 4.5V1.5z" />
						</svg>
						Train
					</>
				)}
			</Button>

			{/* Reset */}
			<Button
				variant="secondary"
				size="md"
				disabled={status === "idle"}
				onClick={handleReset}
				title="Reset training"
			>
				Reset
			</Button>

			<div className="w-px h-6 bg-slate-800" />

			{/* Epoch / batch progress */}
			<div className="flex items-center gap-2 min-w-0">
				<span className="text-xs text-slate-400 whitespace-nowrap">
					Epoch{" "}
					<span className="font-mono text-slate-200">
						{currentEpoch + 1}/{trainingConfig.epochs}
					</span>
				</span>
				<div className="w-24 h-1.5 bg-slate-800 rounded overflow-hidden">
					<div
						className="h-full bg-blue-500 transition-all duration-100"
						style={{ width: `${batchProgress * 100}%` }}
					/>
				</div>
				<span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
					{currentBatch}/{totalBatches}
				</span>
			</div>

			<div className="w-px h-6 bg-slate-800" />

			{/* Overfitting mode toggle */}
			<Tooltip content="Limit training to 500 samples for 50 epochs to demonstrate overfitting">
				<button
					type="button"
					onClick={toggleOverfittingMode}
					disabled={status === "training" || status === "loading"}
					className={[
						"px-2 py-1 rounded text-xs border transition-colors",
						overfittingMode
							? "border-orange-500 bg-orange-500/15 text-orange-300"
							: "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200",
						status === "training" || status === "loading"
							? "opacity-40 cursor-not-allowed"
							: "",
					]
						.filter(Boolean)
						.join(" ")}
				>
					Overfit demo
				</button>
			</Tooltip>

			<div className="ml-auto">
				<span
					className={`text-xs font-medium ${STATUS_COLORS[status] ?? "text-slate-400"}`}
				>
					{STATUS_LABELS[status] ?? status}
				</span>
			</div>

			{/* Validation error hint */}
			{hasErrors && (
				<span className="text-xs text-red-400">
					Fix architecture errors first
				</span>
			)}
		</div>
	);
}
