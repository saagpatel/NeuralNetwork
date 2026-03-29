"use client";

import { DATASETS } from "@/constants/datasets";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import type { DatasetId } from "@/types";

const DATASET_IDS: DatasetId[] = ["mnist", "fashion-mnist", "cifar10"];

// CIFAR-10 is Phase 2 — shown but disabled
const PHASE_2_DATASETS: Set<DatasetId> = new Set(["cifar10"]);

export function DatasetSelector() {
	const datasetId = useTrainingStore((s) => s.datasetId);
	const status = useTrainingStore((s) => s.status);
	const loadProgress = useTrainingStore((s) => s.datasetLoadProgress);
	const setDataset = useTrainingStore((s) => s.setDataset);
	const setInputShape = useArchitectureStore((s) => s.setInputShape);

	const isTraining = status === "training" || status === "loading";

	function handleSelect(id: DatasetId) {
		if (isTraining || PHASE_2_DATASETS.has(id)) return;
		const meta = DATASETS[id];
		setDataset(id);
		setInputShape(meta.inputShape);
	}

	return (
		<div className="p-3">
			<p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
				Dataset
			</p>
			<div className="flex flex-col gap-1.5">
				{DATASET_IDS.map((id) => {
					const meta = DATASETS[id];
					const isSelected = datasetId === id;
					const isPhase2 = PHASE_2_DATASETS.has(id);
					const disabled = isTraining || isPhase2;

					return (
						<button
							key={id}
							type="button"
							disabled={disabled}
							onClick={() => handleSelect(id)}
							className={[
								"w-full text-left px-3 py-2 rounded border transition-colors",
								isSelected && !isPhase2
									? "border-blue-500 bg-blue-500/10"
									: "border-slate-700 bg-slate-900 hover:border-slate-500",
								disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
							]
								.filter(Boolean)
								.join(" ")}
						>
							<div className="flex justify-between items-center">
								<span className="text-xs font-medium text-slate-200">
									{meta.name}
								</span>
								<div className="flex gap-1 items-center">
									{isPhase2 && (
										<span className="text-[10px] px-1 py-0.5 rounded bg-slate-700 text-slate-400">
											Phase 2
										</span>
									)}
									<span className="text-[10px] text-slate-500">
										{meta.downloadSizeMB} MB
									</span>
								</div>
							</div>
							<p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
								{meta.inputShape.join("×")} · {meta.numClasses} classes ·{" "}
								{(meta.trainSize / 1000).toFixed(0)}k train
							</p>
						</button>
					);
				})}
			</div>

			{/* Dataset load progress bar */}
			{status === "loading" && loadProgress > 0 && loadProgress < 1 && (
				<div className="mt-2">
					<div className="flex justify-between text-[10px] text-slate-500 mb-1">
						<span>Downloading dataset…</span>
						<span>{Math.round(loadProgress * 100)}%</span>
					</div>
					<div className="h-1 bg-slate-800 rounded overflow-hidden">
						<div
							className="h-full bg-blue-500 transition-all duration-100"
							style={{ width: `${loadProgress * 100}%` }}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
