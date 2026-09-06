"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { MAX_NETWORK_LAYERS } from "@/constants/network";
import { PRESET_MAP, PRESETS } from "@/constants/presets";
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

/**
 * Compute per-layer param counts, tracking spatial shape through Conv2D/Pool layers.
 * Returns the total trainable parameter count for the entire architecture.
 */
function computeParamCount(
	layers: LayerConfig[],
	inputShape: number[],
): number {
	// currentShape tracks the active spatial/channel shape as we walk layers.
	// inputShape is e.g. [28,28,1] for MNIST or [32,32,3] for CIFAR-10.
	let currentShape: number[] = [...inputShape];
	let total = 0;

	for (const layer of layers) {
		if (layer.type === "conv2d") {
			const inputChannels = currentShape[currentShape.length - 1] ?? 1;
			// params = kernelH * kernelW * inputChannels * filters + filters (bias)
			total +=
				layer.kernelSize * layer.kernelSize * inputChannels * layer.filters +
				layer.filters;

			// Update spatial shape after conv (approximate — ignores valid padding shrink for counting)
			const h = currentShape[0] ?? 1;
			const w = currentShape[1] ?? 1;
			if (layer.padding === "same") {
				const newH = Math.ceil(h / layer.strides);
				const newW = Math.ceil(w / layer.strides);
				currentShape = [newH, newW, layer.filters];
			} else {
				// valid padding: output = floor((input - kernel) / stride) + 1
				const newH = Math.floor((h - layer.kernelSize) / layer.strides) + 1;
				const newW = Math.floor((w - layer.kernelSize) / layer.strides) + 1;
				currentShape = [newH, newW, layer.filters];
			}
		} else if (layer.type === "maxPooling2d") {
			const h = currentShape[0] ?? 1;
			const w = currentShape[1] ?? 1;
			const c = currentShape[2] ?? 1;
			const stride = layer.strides;
			currentShape = [Math.floor(h / stride), Math.floor(w / stride), c];
			// MaxPooling has no learnable params
		} else if (layer.type === "flatten") {
			const flatSize = currentShape.reduce((acc, d) => acc * d, 1);
			currentShape = [flatSize];
		} else if (layer.type === "dense") {
			const prevUnits = currentShape[0] ?? 0;
			total += prevUnits * layer.units + layer.units;
			currentShape = [layer.units];
		}
		// dropout: no params, no shape change
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
	const setInputShape = useArchitectureStore((s) => s.setInputShape);
	const status = useTrainingStore((s) => s.status);

	const [addMenuOpen, setAddMenuOpen] = useState(false);

	const isTraining = status === "training" || status === "loading";
	const atLayerLimit = layers.length >= MAX_NETWORK_LAYERS;
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

	const totalParams = computeParamCount(layers, inputShape);

	function handleAddLayer(type: LayerConfig["type"]) {
		setAddMenuOpen(false);
		if (atLayerLimit) return;
		if (type === "dense") {
			addLayer({ type: "dense", units: 64, activation: "relu" });
		} else if (type === "flatten") {
			addLayer({ type: "flatten" });
		} else if (type === "dropout") {
			addLayer({ type: "dropout", rate: 0.25 });
		} else if (type === "conv2d") {
			addLayer({
				type: "conv2d",
				filters: 32,
				kernelSize: 3,
				strides: 1,
				padding: "same",
				activation: "relu",
			});
		} else if (type === "maxPooling2d") {
			addLayer({ type: "maxPooling2d", poolSize: 2, strides: 2 });
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
						if (!id) return;
						loadPreset(id);
						const preset = PRESET_MAP[id];
						if (preset?.inputShape) {
							setInputShape(preset.inputShape);
						}
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
									className="text-slate-400 hover:text-red-400 disabled:opacity-30 transition-colors text-xs leading-none"
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

							{/* Conv2D config */}
							{layer.type === "conv2d" && (
								<div className="flex flex-col gap-1.5">
									<Slider
										label="Filters"
										min={8}
										max={128}
										step={8}
										value={layer.filters}
										onChange={(v) =>
											updateLayer(i, { ...layer, filters: Math.round(v) })
										}
										disabled={isTraining}
									/>
									<Select
										label="Kernel"
										value={String(layer.kernelSize) as "3" | "5" | "7"}
										options={[
											{ value: "3", label: "3×3" },
											{ value: "5", label: "5×5" },
											{ value: "7", label: "7×7" },
										]}
										onChange={(v) =>
											updateLayer(i, { ...layer, kernelSize: Number(v) })
										}
										disabled={isTraining}
									/>
									<Select
										label="Stride"
										value={String(layer.strides) as "1" | "2"}
										options={[
											{ value: "1", label: "1" },
											{ value: "2", label: "2" },
										]}
										onChange={(v) =>
											updateLayer(i, { ...layer, strides: Number(v) })
										}
										disabled={isTraining}
									/>
									<Select
										label="Padding"
										value={layer.padding}
										options={[
											{ value: "same", label: "same" },
											{ value: "valid", label: "valid" },
										]}
										onChange={(v) =>
											updateLayer(i, {
												...layer,
												padding: v as "same" | "valid",
											})
										}
										disabled={isTraining}
									/>
									<Select
										label="Activation"
										value={layer.activation}
										options={ACTIVATION_OPTIONS}
										disabled={isTraining}
										onChange={(v) =>
											updateLayer(i, {
												...layer,
												activation: v as ActivationFn,
											})
										}
									/>
								</div>
							)}

							{/* MaxPooling2D config */}
							{layer.type === "maxPooling2d" && (
								<Select
									label="Pool size"
									value={String(layer.poolSize) as "2" | "3"}
									options={[
										{ value: "2", label: "2×2" },
										{ value: "3", label: "3×3" },
									]}
									onChange={(v) =>
										updateLayer(i, {
											...layer,
											poolSize: Number(v),
											strides: Number(v),
										})
									}
									disabled={isTraining}
								/>
							)}

							{/* Flatten: no config */}
							{layer.type === "flatten" && (
								<p className="text-[10px] text-slate-400">No config</p>
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
					disabled={isTraining || atLayerLimit}
					title={
						atLayerLimit
							? `Maximum ${MAX_NETWORK_LAYERS} layers`
							: undefined
					}
					onClick={() => setAddMenuOpen((o) => !o)}
					className="w-full border border-dashed border-slate-700 hover:border-slate-500 text-slate-400"
				>
					+ Add Layer
				</Button>
				{addMenuOpen && (
					<div className="absolute top-full left-0 right-0 mt-1 rounded border border-slate-700 bg-slate-900 z-10 overflow-hidden">
						{[
							{ type: "dense" as const, label: "Dense" },
							{ type: "flatten" as const, label: "Flatten" },
							{ type: "dropout" as const, label: "Dropout" },
							{ type: "conv2d" as const, label: "Conv2D" },
							{ type: "maxPooling2d" as const, label: "MaxPooling2D" },
						].map(({ type, label }) => (
							<button
								key={type}
								type="button"
								onClick={() => handleAddLayer(type)}
								className="w-full text-left px-3 py-1.5 text-xs transition-colors text-slate-300 hover:bg-slate-800"
							>
								{label}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Param count footer */}
			<div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
				<span className="text-[10px] text-slate-400">Total parameters</span>
				<span className="text-xs font-mono text-slate-300">
					{totalParams.toLocaleString()}
				</span>
			</div>
		</div>
	);
}
