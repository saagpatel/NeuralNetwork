"use client";

import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { useTrainingStore } from "@/stores/training-store";
import { useUIStore } from "@/stores/ui-store";
import type { OptimizerType, RegularizationType } from "@/types";

const OPTIMIZER_OPTIONS: { value: OptimizerType; label: string }[] = [
	{ value: "adam", label: "Adam" },
	{ value: "sgd", label: "SGD" },
	{ value: "rmsprop", label: "RMSProp" },
	{ value: "adagrad", label: "Adagrad" },
];

const REGULARIZATION_OPTIONS: { value: RegularizationType; label: string }[] = [
	{ value: "none", label: "None" },
	{ value: "l1", label: "L1 (Lasso)" },
	{ value: "l2", label: "L2 (Ridge)" },
];

const BATCH_SIZE_OPTIONS = [16, 32, 64, 128, 256].map((n) => ({
	value: String(n),
	label: String(n),
}));

const SNAPSHOT_RATE_OPTIONS = [1, 5, 10, 20].map((n) => ({
	value: String(n),
	label: `Every ${n} batch${n === 1 ? "" : "es"}`,
}));

export function HyperparamPanel() {
	const config = useTrainingStore((s) => s.trainingConfig);
	const status = useTrainingStore((s) => s.status);
	const updateConfig = useTrainingStore((s) => s.updateTrainingConfig);
	const snapshotRate = useUIStore((s) => s.snapshotEveryNBatches);
	const setSnapshotRate = useUIStore((s) => s.setSnapshotRate);

	const disabled = status === "training" || status === "loading";

	return (
		<div className="p-3">
			<p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
				Hyperparameters
			</p>

			<div className="flex flex-col gap-3">
				<Select
					label="Optimizer"
					value={config.optimizer}
					options={OPTIMIZER_OPTIONS}
					disabled={disabled}
					onChange={(v) => updateConfig({ optimizer: v })}
				/>

				<Slider
					label="Learning rate"
					value={config.learningRate}
					min={0.0001}
					max={0.1}
					step={0.0001}
					disabled={disabled}
					format={(v) => v.toExponential(1)}
					onChange={(v) => updateConfig({ learningRate: v })}
				/>

				<Select
					label="Batch size"
					value={String(config.batchSize)}
					options={BATCH_SIZE_OPTIONS}
					disabled={disabled}
					onChange={(v) => updateConfig({ batchSize: parseInt(v, 10) })}
				/>

				<div className="flex flex-col gap-1">
					<span className="text-xs text-slate-400">Epochs</span>
					<input
						type="number"
						min={1}
						max={200}
						value={config.epochs}
						disabled={disabled}
						onChange={(e) => {
							const val = parseInt(e.target.value, 10);
							if (!isNaN(val) && val >= 1 && val <= 200) {
								updateConfig({ epochs: val });
							}
						}}
						className={[
							"w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700",
							"text-xs text-slate-200 focus:outline-none focus:border-blue-500",
							disabled ? "opacity-40 cursor-not-allowed" : "",
						]
							.filter(Boolean)
							.join(" ")}
					/>
				</div>

				<Slider
					label="Validation split"
					value={config.validationSplit}
					min={0.1}
					max={0.5}
					step={0.05}
					disabled={disabled}
					format={(v) => `${(v * 100).toFixed(0)}%`}
					onChange={(v) => updateConfig({ validationSplit: v })}
				/>

				<Select
					label="Regularization"
					value={config.regularization}
					options={REGULARIZATION_OPTIONS}
					disabled={disabled}
					onChange={(v) => updateConfig({ regularization: v })}
				/>

				{config.regularization !== "none" && (
					<Slider
						label="Regularization rate"
						value={config.regularizationRate}
						min={0.0001}
						max={0.1}
						step={0.0001}
						disabled={disabled}
						format={(v) => v.toExponential(1)}
						onChange={(v) => updateConfig({ regularizationRate: v })}
					/>
				)}

				<Select
					label="Canvas update rate"
					value={String(snapshotRate)}
					options={SNAPSHOT_RATE_OPTIONS}
					disabled={disabled}
					onChange={(v) => setSnapshotRate(parseInt(v, 10))}
				/>
			</div>
		</div>
	);
}
