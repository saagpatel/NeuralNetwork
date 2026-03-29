"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { PRESETS } from "@/constants/presets";
import { validateArchitecture } from "@/lib/architecture-validator";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import type { ActivationFn, LayerConfig } from "@/types";

const ACTIVATION_OPTIONS: { value: ActivationFn; label: string }[] = [
	{ value: "relu", label: "ReLU" },
	{ value: "sigmoid", label: "Sigmoid" },
	{ value: "tanh", label: "Tanh" },
	{ value: "linear", label: "Linear" },
	{ value: "elu", label: "ELU" },
	{ value: "selu", label: "SELU" },
	{ value: "swish", label: "Swish" },
	{ value: "softmax", label: "Softmax" },
];

const LAYER_TYPE_COLORS: Record<string, string> = {
	dense: "bg-blue-500/20 text-blue-300 border-blue-500/30",
	conv2d: "bg-purple-500/20 text-purple-300 border-purple-500/30",
	maxPooling2d: "bg-teal-500/20 text-teal-300 border-teal-500/30",
	flatten: "bg-slate-500/20 text-slate-300 border-slate-500/30",
	dropout: "bg-orange-500/20 text-orange-300 border-orange-500/30",
	input: "bg-green-500/20 text-green-300 border-green-500/30",
};

const LAYER_TYPE_LABELS: Record<string, string> = {
	dense: "Dense",
	conv2d: "Conv2D",
	maxPooling2d: "MaxPool",
	flatten: "Flatten",
	dropout: "Dropout",
};

function computeParamCount(layers: LayerConfig[]): number {
	let prevUnits = 0;
	// Estimate input units from flatten position
	let total = 0;
	for (const layer of layers) {
		if (layer.type === "flatten") {
			prevUnits = 784; // default MNIST — approximate
		} else if (layer.type === "dense") {
			total += prevUnits * layer.units + layer.units;
			prevUnits = layer.units;
		}
	}
	return total;
}

export function NetworkArchitect() {
	const layers = useArchitectureStore((s) => s.layers);
	const inputShape = useArchitectureStore((s) => s.inputShape);
	const addLayer = useArchitectureStore((s) => s.addLayer);
	const removeLayer = useArchitectureStore((s) => s.removeLayer);
	const updateLayer = useArchitectureStore((s) => s.updateLayer);
	const loadPreset = useArchitectureStore((s) => s.loadPreset);
	const status = useTrainingStore((s) => s.status);

	const [addMenuOpen, setAddMenuOpen] = useState(false);

	const isTraining = status === "training" || status === "loading";
	const validationErrors = validateArchitecture(layers, inputShape);
	const errorsByLayer = new Map<number, string[]>();
	const globalErrors: string[] = [];

	for (const e of validationErrors) {
		if (e.severity !== "error") continue;
		if (e.layerIndex === null) {
			globalErrors.push(e.message);
		} else {
			const existing = errorsByLayer.get(e.layerIndex) ?? [];
			existing.push(e.message);
			errorsByLayer.set(e.layerIndex, existing);
		}
	}
	const warnings = validationErrors.filter((e) => e.severity === "warning");

	const totalParams = computeParamCount(layers);

	function handleAddLayer(type: LayerConfig["type"]) {
		setAddMenuOpen(false);
		if (type === "dense") {
			addLayer({ type: "dense", units: 64, activation: "relu" });
		} else if (type === "flatten") {
			addLayer({ type: "flatten" });
		} else if (type === "dropout") {
			addLayer({ type: "dropout", rate: 0.25 });
		}
	}

	return (
		<div className="p-3">
			{/* Preset selector */}
			<div className="mb-3">
				<Select
					label="Preset"
					value=""
					options={[
						{ value: "", label: "Load a preset…" },
						...PRESETS.map((p) => ({ value: p.id, label: p.name })),
					]}
					onChange={(id) => {
						if (id) loadPreset(id);
					}}
					disabled={isTraining}
				/>
			</div>

			<p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
				Architecture
			</p>

			{/* Validation errors */}
			{globalErrors.length > 0 && (
				<div className="mb-2 p-2 rounded bg-red-900/30 border border-red-700/50">
					{globalErrors.map((msg) => (
						<p key={msg} className="text-xs text-red-300">
							{msg}
						</p>
					))}
				</div>
			)}
			{warnings.length > 0 && (
				<div className="mb-2 p-2 rounded bg-yellow-900/30 border border-yellow-700/50">
					{warnings.map((w) => (
						<p key={w.message} className="text-xs text-yellow-300">
							{w.message}
						</p>
					))}
				</div>
			)}

			{/* Layer list */}
			<div className="flex flex-col gap-1.5 mb-2">
				{layers.map((layer, i) => {
					const errs = errorsByLayer.get(i) ?? [];
					const colorClass =
						LAYER_TYPE_COLORS[layer.type] ?? LAYER_TYPE_COLORS.dense;

					return (
						<div
							key={i}
							className={[
								"rounded border p-2",
								errs.length > 0
									? "border-red-600/50 bg-red-900/20"
									: "border-slate-700 bg-slate-900",
							].join(" ")}
						>
							<div className="flex items-center justify-between mb-1.5">
								<span
									className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colorClass}`}
								>
									{LAYER_TYPE_LABELS[layer.type] ?? layer.type}
								</span>
								<button
									type="button"
									disabled={isTraining}
									onClick={() => removeLayer(i)}
									className="text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors text-xs leading-none"
									title="Remove layer"
								>
									✕
								</button>
							</div>

							{/* Dense config */}
							{layer.type === "dense" && (
								<div className="flex flex-col gap-1.5">
									<Slider
										label="Units"
										value={layer.units}
										min={2}
										max={512}
										step={1}
										disabled={isTraining}
										onChange={(v) =>
											updateLayer(i, {
												units: Math.round(v),
											} as Partial<LayerConfig>)
										}
									/>
									<Select
										label="Activation"
										value={layer.activation}
										options={ACTIVATION_OPTIONS}
										disabled={isTraining}
										onChange={(v) =>
											updateLayer(i, { activation: v } as Partial<LayerConfig>)
										}
									/>
								</div>
							)}

							{/* Dropout config */}
							{layer.type === "dropout" && (
								<Slider
									label="Drop rate"
									value={layer.rate}
									min={0.05}
									max={0.5}
									step={0.05}
									disabled={isTraining}
									format={(v) => `${(v * 100).toFixed(0)}%`}
									onChange={(v) =>
										updateLayer(i, { rate: v } as Partial<LayerConfig>)
									}
								/>
							)}

							{/* Flatten / Conv / Pool: no config in Phase 1 */}
							{(layer.type === "flatten" ||
								layer.type === "conv2d" ||
								layer.type === "maxPooling2d") && (
								<p className="text-[10px] text-slate-500">No config</p>
							)}

							{errs.length > 0 && (
								<div className="mt-1">
									{errs.map((msg) => (
										<p key={msg} className="text-[10px] text-red-400">
											{msg}
										</p>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Add layer button */}
			<div className="relative">
				<Button
					variant="ghost"
					size="sm"
					disabled={isTraining}
					onClick={() => setAddMenuOpen((o) => !o)}
					className="w-full border border-dashed border-slate-700 hover:border-slate-500 text-slate-400"
				>
					+ Add Layer
				</Button>
				{addMenuOpen && (
					<div className="absolute top-full left-0 right-0 mt-1 rounded border border-slate-700 bg-slate-900 z-10 overflow-hidden">
						{[
							{ type: "dense" as const, label: "Dense", phase2: false },
							{ type: "flatten" as const, label: "Flatten", phase2: false },
							{ type: "dropout" as const, label: "Dropout", phase2: false },
							{ type: "conv2d" as const, label: "Conv2D", phase2: true },
							{
								type: "maxPooling2d" as const,
								label: "MaxPooling2D",
								phase2: true,
							},
						].map(({ type, label, phase2: disabled }) => (
							<button
								key={type}
								type="button"
								disabled={disabled}
								onClick={() => handleAddLayer(type)}
								className={[
									"w-full text-left px-3 py-1.5 text-xs transition-colors",
									disabled
										? "text-slate-600 cursor-not-allowed"
										: "text-slate-300 hover:bg-slate-800",
								].join(" ")}
							>
								{label}
								{disabled ? (
									<span className="ml-1 text-[10px] text-slate-600">
										Phase 2
									</span>
								) : null}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Param count footer */}
			<div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
				<span className="text-[10px] text-slate-500">Total parameters</span>
				<span className="text-xs font-mono text-slate-300">
					{totalParams.toLocaleString()}
				</span>
			</div>
		</div>
	);
}
