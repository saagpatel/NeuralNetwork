"use client";

import { useEffect, useRef, useState } from "react";
import { DATASETS } from "@/constants/datasets";
import { useTrainingStore } from "@/stores/training-store";

interface TooltipState {
	x: number;
	y: number;
	trueLabel: string;
	predLabel: string;
	count: number;
}

// ─── Canvas Rendering ────────────────────────────────────────────────────────

const LABEL_W = 52; // px reserved for row labels on the left
const LABEL_H = 52; // px reserved for col labels on the bottom
const MIN_CELL = 20;
const PADDING = 8;

function renderMatrix(
	canvas: HTMLCanvasElement,
	matrix: number[][],
	classLabels: string[],
	dpr: number,
) {
	const n = matrix.length;
	const logicalW = canvas.width / dpr;
	const logicalH = canvas.height / dpr;
	const gridW = logicalW - LABEL_W - PADDING;
	const gridH = logicalH - LABEL_H - PADDING;
	const cell = Math.max(MIN_CELL, Math.floor(Math.min(gridW, gridH) / n));

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	ctx.clearRect(0, 0, logicalW, logicalH);

	// Row sums for normalization
	const rowSums = matrix.map((row) => row.reduce((a, b) => a + b, 0));

	for (let row = 0; row < n; row++) {
		for (let col = 0; col < n; col++) {
			const raw = matrix[row]?.[col] ?? 0;
			const rowSum = rowSums[row] ?? 1;
			const norm = rowSum > 0 ? raw / rowSum : 0;

			const x = LABEL_W + col * cell;
			const y = PADDING + row * cell;

			// Background fill — blue scale
			const alpha = 0.08 + norm * 0.82;
			ctx.fillStyle =
				row === col
					? `rgba(34, 197, 94, ${alpha})` // green diagonal
					: `rgba(37, 99, 235, ${alpha})`;
			ctx.fillRect(x, y, cell, cell);

			// Diagonal border
			if (row === col) {
				ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
				ctx.lineWidth = 1;
				ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
			}

			// Count text — skip zeros
			if (raw > 0) {
				ctx.fillStyle = norm > 0.55 ? "#0f172a" : "#e2e8f0";
				ctx.font = `${cell > 26 ? 9 : 7}px ui-monospace, monospace`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(
					raw > 999 ? "999+" : String(raw),
					x + cell / 2,
					y + cell / 2,
				);
			}
		}
	}

	// Row labels (left side) — truncate to 6 chars
	ctx.fillStyle = "#94a3b8";
	ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
	ctx.textAlign = "right";
	ctx.textBaseline = "middle";
	for (let i = 0; i < n; i++) {
		const label = (classLabels[i] ?? String(i)).slice(0, 6);
		ctx.fillText(label, LABEL_W - 4, PADDING + i * cell + cell / 2);
	}

	// Col labels (bottom) — rotated 45°
	ctx.save();
	ctx.fillStyle = "#94a3b8";
	ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
	ctx.textAlign = "right";
	ctx.textBaseline = "middle";
	for (let i = 0; i < n; i++) {
		const label = (classLabels[i] ?? String(i)).slice(0, 6);
		const cx = LABEL_W + i * cell + cell / 2;
		const cy = PADDING + n * cell + 6;
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(-Math.PI / 4);
		ctx.fillText(label, 0, 0);
		ctx.restore();
	}
	ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfusionMatrix() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const matrix = useTrainingStore((s) => s.latestConfusionMatrix);
	const datasetId = useTrainingStore((s) => s.datasetId);
	const [tooltip, setTooltip] = useState<TooltipState | null>(null);

	const classLabels = DATASETS[datasetId]?.classLabels ?? [];
	const n = classLabels.length || 10;

	// Redraw when matrix or labels change
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !matrix) return;
		const dpr = window.devicePixelRatio || 1;
		renderMatrix(canvas, matrix, classLabels, dpr);
	}, [matrix, classLabels]);

	// Resize observer to keep canvas pixel-perfect
	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!container || !canvas) return;

		const ro = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			if (width === 0 || height === 0) return;
			const dpr = window.devicePixelRatio || 1;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			const ctx = canvas.getContext("2d");
			if (ctx) ctx.scale(dpr, dpr);
			if (matrix) renderMatrix(canvas, matrix, classLabels, dpr);
		});
		ro.observe(container);
		return () => ro.disconnect();
	}, [matrix, classLabels]);

	function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
		if (!matrix) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const lx = e.clientX - rect.left;
		const ly = e.clientY - rect.top;
		const cell = Math.max(
			MIN_CELL,
			Math.floor(
				Math.min(
					rect.width - LABEL_W - PADDING,
					rect.height - LABEL_H - PADDING,
				) / n,
			),
		);
		const col = Math.floor((lx - LABEL_W) / cell);
		const row = Math.floor((ly - PADDING) / cell);
		if (col >= 0 && col < n && row >= 0 && row < n) {
			const count = matrix[row]?.[col] ?? 0;
			setTooltip({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top - 40,
				trueLabel: classLabels[row] ?? String(row),
				predLabel: classLabels[col] ?? String(col),
				count,
			});
		} else {
			setTooltip(null);
		}
	}

	return (
		<div className="flex flex-col h-full">
			<div className="px-3 py-2 border-b border-slate-800 flex-shrink-0">
				<p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
					Confusion Matrix
				</p>
			</div>

			{!matrix ? (
				<div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
					{/* Placeholder 10×10 grid */}
					<div
						className="grid gap-px"
						style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, width: 160 }}
					>
						{Array.from({ length: n * n }).map((_, i) => (
							<div
								key={i}
								className="aspect-square"
								style={{ background: "#1e293b" }}
							/>
						))}
					</div>
					<p className="text-xs text-slate-500 text-center">
						Train to see confusion matrix
					</p>
				</div>
			) : (
				<div
					ref={containerRef}
					className="flex-1 relative min-h-0"
					onMouseLeave={() => setTooltip(null)}
				>
					<canvas
						ref={canvasRef}
						className="w-full h-full"
						onMouseMove={handleMouseMove}
					/>
					{tooltip && (
						<div
							className="absolute pointer-events-none bg-slate-800 text-slate-200 text-[10px] rounded px-2 py-1 shadow-lg border border-slate-700 whitespace-nowrap z-10"
							style={{ left: tooltip.x + 8, top: tooltip.y }}
						>
							True:{" "}
							<span className="text-slate-300 font-medium">
								{tooltip.trueLabel}
							</span>
							{" · "}
							Pred:{" "}
							<span className="text-slate-300 font-medium">
								{tooltip.predLabel}
							</span>
							{" · "}
							Count:{" "}
							<span className="text-white font-semibold">{tooltip.count}</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
