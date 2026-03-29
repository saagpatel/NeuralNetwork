"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DATASETS } from "@/constants/datasets";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import type { LayerActivation } from "@/types";
import { getTrainingWorker } from "@/workers/training.api";

// ─── Viridis color map ────────────────────────────────────────────────────────

const VIRIDIS_STOPS: [number, number, number][] = [
	[68, 1, 84],
	[58, 82, 139],
	[32, 144, 141],
	[94, 201, 98],
	[253, 231, 37],
];

function viridisRGB(t: number): [number, number, number] {
	const clamped = Math.max(0, Math.min(1, t));
	const idx = clamped * (VIRIDIS_STOPS.length - 1);
	const lo = Math.floor(idx);
	const hi = Math.min(VIRIDIS_STOPS.length - 1, lo + 1);
	const frac = idx - lo;
	const a = VIRIDIS_STOPS[lo]!;
	const b = VIRIDIS_STOPS[hi]!;
	return [
		Math.round(a[0] + (b[0] - a[0]) * frac),
		Math.round(a[1] + (b[1] - a[1]) * frac),
		Math.round(a[2] + (b[2] - a[2]) * frac),
	];
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function drawImageSample(
	canvas: HTMLCanvasElement,
	sample: unknown, // number[][][] at runtime (H×W×C)
	isRGB: boolean,
) {
	const img = sample as number[][][];
	const H = img.length;
	const W = img[0]?.length ?? 0;
	if (H === 0 || W === 0) return;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	canvas.width = W;
	canvas.height = H;
	const imageData = ctx.createImageData(W, H);
	for (let h = 0; h < H; h++) {
		for (let w = 0; w < W; w++) {
			const px = img[h]?.[w];
			const idx = (h * W + w) * 4;
			if (isRGB) {
				imageData.data[idx] = Math.round(((px as number[])[0] ?? 0) * 255);
				imageData.data[idx + 1] = Math.round(((px as number[])[1] ?? 0) * 255);
				imageData.data[idx + 2] = Math.round(((px as number[])[2] ?? 0) * 255);
			} else {
				const v = Math.round(
					((px as number[])[0] ?? (px as unknown as number)) * 255,
				);
				imageData.data[idx] = v;
				imageData.data[idx + 1] = v;
				imageData.data[idx + 2] = v;
			}
			imageData.data[idx + 3] = 255;
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

function drawFeatureMap(
	canvas: HTMLCanvasElement,
	data: Float32Array,
	H: number,
	W: number,
	filterIdx: number,
	C: number,
) {
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	// Find min/max for this filter to normalize
	let min = Infinity;
	let max = -Infinity;
	for (let h = 0; h < H; h++) {
		for (let w = 0; w < W; w++) {
			const v = data[h * W * C + w * C + filterIdx] ?? 0;
			if (v < min) min = v;
			if (v > max) max = v;
		}
	}
	const range = max - min || 1;

	const imageData = ctx.createImageData(W, H);
	for (let h = 0; h < H; h++) {
		for (let w = 0; w < W; w++) {
			const v = data[h * W * C + w * C + filterIdx] ?? 0;
			const t = (v - min) / range;
			const [r, g, b] = viridisRGB(t);
			const idx = (h * W + w) * 4;
			imageData.data[idx] = r;
			imageData.data[idx + 1] = g;
			imageData.data[idx + 2] = b;
			imageData.data[idx + 3] = 255;
		}
	}
	ctx.putImageData(imageData, 0, 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SampleThumbnail({
	sample,
	label,
	isRGB,
	isSelected,
	isCorrect,
	onClick,
}: {
	sample: unknown;
	label: string;
	isRGB: boolean;
	isSelected: boolean;
	isCorrect: boolean;
	onClick: () => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		drawImageSample(canvas, sample, isRGB);
	}, [sample, isRGB]);

	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"flex flex-col items-center gap-0.5 rounded cursor-pointer p-0.5",
				isSelected
					? "ring-2 ring-blue-500"
					: "ring-1 ring-slate-700 hover:ring-slate-500",
			].join(" ")}
		>
			<canvas
				ref={canvasRef}
				className="block"
				style={{ width: 28, height: 28, imageRendering: "pixelated" }}
			/>
			<span className="text-[7px] text-slate-400 leading-none">
				{label.slice(0, 4)}
				{isCorrect ? " ✓" : ""}
			</span>
		</button>
	);
}

function DenseActivationBar({ activations }: { activations: Float32Array }) {
	const MAX_NEURONS = 64;
	const shown = activations.slice(0, MAX_NEURONS);
	const max = Math.max(...Array.from(shown)) || 1;

	return (
		<div className="flex items-end gap-px h-8 overflow-hidden">
			{Array.from(shown).map((v, i) => (
				<div
					key={i}
					className="flex-1 min-w-[1px]"
					style={{
						height: `${(v / max) * 100}%`,
						backgroundColor: `rgba(37, 99, 235, ${0.4 + (v / max) * 0.6})`,
					}}
				/>
			))}
			{activations.length > MAX_NEURONS && (
				<span className="text-[8px] text-slate-600 self-center ml-1">
					+{activations.length - MAX_NEURONS}
				</span>
			)}
		</div>
	);
}

function OutputProbabilities({
	activations,
	classLabels,
}: {
	activations: Float32Array;
	classLabels: string[];
}) {
	const topK = Array.from(activations)
		.map((v, i) => ({ v, i }))
		.sort((a, b) => b.v - a.v)
		.slice(0, 5);

	return (
		<div className="flex flex-col gap-1">
			{topK.map(({ v, i }) => (
				<div key={i} className="flex items-center gap-2">
					<span className="text-[9px] text-slate-400 w-14 truncate text-right">
						{classLabels[i] ?? String(i)}
					</span>
					<div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
						<div
							className="h-full rounded"
							style={{
								width: `${v * 100}%`,
								backgroundColor: i === topK[0]?.i ? "#3b82f6" : "#475569",
							}}
						/>
					</div>
					<span className="text-[9px] text-slate-500 w-8 text-right">
						{(v * 100).toFixed(0)}%
					</span>
				</div>
			))}
		</div>
	);
}

function ConvActivationMaps({ activation }: { activation: LayerActivation }) {
	const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
	const [H, W, C] =
		activation.shape.length === 3
			? [activation.shape[0]!, activation.shape[1]!, activation.shape[2]!]
			: [1, 1, 1];
	const numMaps = Math.min(16, C);

	useEffect(() => {
		for (let f = 0; f < numMaps; f++) {
			const canvas = canvasRefs.current[f];
			if (canvas) drawFeatureMap(canvas, activation.data, H, W, f, C);
		}
	}, [activation, H, W, C, numMaps]);

	return (
		<div className="flex flex-wrap gap-1">
			{Array.from({ length: numMaps }).map((_, f) => (
				<canvas
					key={f}
					ref={(el) => {
						canvasRefs.current[f] = el;
					}}
					className="rounded"
					style={{ width: 20, height: 20, imageRendering: "pixelated" }}
				/>
			))}
			{C > numMaps && (
				<span className="text-[9px] text-slate-600 self-center">
					+{C - numMaps} more
				</span>
			)}
		</div>
	);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActivationViewer() {
	const status = useTrainingStore((s) => s.status);
	const datasetId = useTrainingStore((s) => s.datasetId);
	const layers = useArchitectureStore((s) => s.layers);

	const [samples, setSamples] = useState<{
		xs: unknown[];
		ys: number[];
		preds: number[];
	} | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [activations, setActivations] = useState<LayerActivation[] | null>(
		null,
	);
	const [loading, setLoading] = useState(false);

	const classLabels = DATASETS[datasetId]?.classLabels ?? [];
	const isRGB = (DATASETS[datasetId]?.inputShape[2] ?? 1) === 3;

	const fetchSamples = useCallback(async () => {
		setLoading(true);
		try {
			const { api } = getTrainingWorker();
			const result = await api.getTestSamples(20);
			// Also run activations for first sample to get predictions
			const actResult = await api.getActivations(0);
			// Extract predictions from output layer
			const outputAct = actResult[actResult.length - 1];
			const predsArr: number[] = [];
			if (outputAct) {
				// Each call fetches single sample — batch fetch all preds
				const allPreds = await Promise.all(
					result.xs.map((_, i) =>
						api.getActivations(i).then((acts) => {
							const out = acts[acts.length - 1];
							if (!out) return -1;
							let maxIdx = 0;
							let maxVal = -Infinity;
							for (let j = 0; j < out.data.length; j++) {
								if ((out.data[j] ?? 0) > maxVal) {
									maxVal = out.data[j] ?? 0;
									maxIdx = j;
								}
							}
							return maxIdx;
						}),
					),
				);
				predsArr.push(...allPreds);
			}
			setSamples({
				xs: result.xs as unknown[],
				ys: result.ys,
				preds: predsArr,
			});
			setActivations(actResult);
			// Auto-select first wrong prediction
			const firstWrong = predsArr.findIndex((p, i) => p !== result.ys[i]);
			setSelectedIndex(firstWrong >= 0 ? firstWrong : 0);
		} catch {
			// Worker not ready or training not complete
		} finally {
			setLoading(false);
		}
	}, []);

	// Fetch when training completes
	useEffect(() => {
		if (status === "complete") {
			void fetchSamples();
		}
	}, [status, fetchSamples]);

	const handleSelectSample = async (idx: number) => {
		setSelectedIndex(idx);
		try {
			const { api } = getTrainingWorker();
			const acts = await api.getActivations(idx);
			setActivations(acts);
		} catch {
			// ignore
		}
	};

	const isOutputLayer = (layerIdx: number) => layerIdx === layers.length - 1;

	if (status !== "complete" && !samples) {
		return (
			<div className="flex flex-col h-full">
				<div className="px-3 py-2 border-b border-slate-800 flex-shrink-0">
					<p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
						Activations
					</p>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<p className="text-xs text-slate-500 text-center px-4">
						{status === "training" || status === "paused"
							? "Activations available after training completes"
							: "Train a model to inspect activations"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="px-3 py-2 border-b border-slate-800 flex-shrink-0">
				<p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
					Activations
				</p>
			</div>

			<div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-3">
				{/* Sample thumbnails */}
				{samples ? (
					<div>
						<p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">
							Test Samples — click to inspect
						</p>
						<div className="grid grid-cols-5 gap-1">
							{samples.xs.map((sample, i) => (
								<SampleThumbnail
									key={i}
									sample={sample}
									label={
										classLabels[samples.ys[i] ?? 0] ?? String(samples.ys[i])
									}
									isRGB={isRGB}
									isSelected={i === selectedIndex}
									isCorrect={samples.preds[i] === samples.ys[i]}
									onClick={() => void handleSelectSample(i)}
								/>
							))}
						</div>
					</div>
				) : (
					<div className="flex items-center justify-center py-4">
						<span className="text-[10px] text-slate-500">
							{loading ? "Loading samples…" : "No samples"}
						</span>
					</div>
				)}

				{/* Per-layer activations */}
				{activations && activations.length > 0 && (
					<div className="space-y-2">
						<p className="text-[9px] text-slate-500 uppercase tracking-wider">
							Layer Activations
						</p>
						{activations.map((act, i) => {
							// layerConfig available for future type-specific rendering

							return (
								<div key={i} className="bg-slate-900 rounded p-2">
									<p className="text-[9px] text-slate-500 mb-1.5 flex items-center gap-1">
										<span className="text-slate-400 font-medium">
											{act.layerName}
										</span>
										<span className="text-slate-700">·</span>
										<span>{act.shape.join("×")}</span>
									</p>
									{act.shape.length === 3 ? (
										<ConvActivationMaps activation={act} />
									) : isOutputLayer(act.layerIndex) ? (
										<OutputProbabilities
											activations={act.data}
											classLabels={classLabels}
										/>
									) : (
										<DenseActivationBar activations={act.data} />
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
