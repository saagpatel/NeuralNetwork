"use client";

import { useEffect, useRef } from "react";
import {
	computeNetworkLayout,
	type LayerGeometry,
	type NetworkLayout,
} from "@/lib/network-layout";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import type { WeightSnapshot } from "@/types";

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function lerpColor(
	t: number,
	r0: number,
	g0: number,
	b0: number,
	r1: number,
	g1: number,
	b1: number,
): string {
	const r = Math.round(r0 + t * (r1 - r0));
	const g = Math.round(g0 + t * (g1 - g0));
	const b = Math.round(b0 + t * (b1 - b0));
	return `rgb(${r},${g},${b})`;
}

// Weight color: positive=blue, negative=orange, magnitude→opacity
function weightColor(w: number): string {
	const abs = Math.min(1, Math.abs(w) * 2);
	const alpha = 0.05 + abs * 0.7;
	if (w >= 0) return `rgba(59,130,246,${alpha.toFixed(2)})`;
	return `rgba(249,115,22,${alpha.toFixed(2)})`;
}

// Viridis-approximation: 0→dark blue, 0.5→teal, 1→yellow
function activationColor(t: number): string {
	if (t < 0.5) return lerpColor(t * 2, 68, 1, 84, 33, 145, 140);
	return lerpColor((t - 0.5) * 2, 33, 145, 140, 253, 231, 37);
}

function drawDenseLayerGeometry(
	ctx: CanvasRenderingContext2D,
	layer: Extract<
		LayerGeometry,
		{ type: "dense" | "flatten" | "dropout" | "input" }
	>,
	weights: WeightSnapshot | undefined,
	dpr: number,
) {
	const { nodes, visibleCount, totalCount, label, type } = layer;
	const hasEllipsis = visibleCount < totalCount;
	const midIdx = Math.floor(visibleCount / 2);

	// Draw nodes
	nodes.forEach((node, i) => {
		// Skip middle node position if we're showing ellipsis — draw dots there instead
		const isEllipsisSlot = hasEllipsis && i === midIdx;

		if (isEllipsisSlot) {
			ctx.fillStyle = "#94a3b8";
			for (let d = -1; d <= 1; d++) {
				ctx.beginPath();
				ctx.arc(node.x * dpr, (node.y + d * 8) * dpr, 2 * dpr, 0, Math.PI * 2);
				ctx.fill();
			}
			return;
		}

		// Activation color: use weight magnitude as proxy when no real activations
		let fill = "#1e293b";
		if (weights && type === "dense") {
			const neuronIdx = i < midIdx ? i : i - 1; // adjust for skipped ellipsis slot
			const biasVal = weights.biases[neuronIdx] ?? 0;
			const t = Math.max(0, Math.min(1, (biasVal + 1) / 2));
			fill = activationColor(t);
		} else if (type === "input") {
			fill = "#334155";
		} else if (type === "flatten") {
			fill = "#334155";
		} else if (type === "dropout") {
			fill = "#431407";
		}

		ctx.beginPath();
		ctx.arc(node.x * dpr, node.y * dpr, node.radius * dpr, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.strokeStyle = "#475569";
		ctx.lineWidth = dpr;
		ctx.stroke();
	});

	// Label below the column
	const lastNode = nodes[nodes.length - 1];
	if (lastNode) {
		const labelY = lastNode.y + lastNode.radius + 14;
		ctx.fillStyle = "#64748b";
		ctx.font = `${9 * dpr}px monospace`;
		ctx.textAlign = "center";
		const lines = label.split("\n");
		lines.forEach((line, i) => {
			ctx.fillText(line, layer.x * dpr, (labelY + i * 12) * dpr);
		});
	}
}

function drawConvLayerGeometry(
	ctx: CanvasRenderingContext2D,
	layer: Extract<LayerGeometry, { type: "conv2d" | "maxPooling2d" }>,
	canvasHeight: number,
	dpr: number,
) {
	// Phase 1: render as a stack of 3 feature-map placeholder rectangles
	const rectW = 28 * dpr;
	const rectH = 20 * dpr;
	const stackOffset = 6 * dpr;
	const cx = layer.x * dpr;
	const cy = (canvasHeight / 2) * dpr;

	for (let s = 2; s >= 0; s--) {
		const x = cx - rectW / 2 + s * stackOffset;
		const y = cy - rectH / 2 - s * stackOffset;
		ctx.strokeStyle = layer.type === "conv2d" ? "#7c3aed" : "#0d9488";
		ctx.fillStyle =
			layer.type === "conv2d"
				? "rgba(124,58,237,0.15)"
				: "rgba(13,148,136,0.15)";
		ctx.lineWidth = dpr;
		ctx.fillRect(x, y, rectW, rectH);
		ctx.strokeRect(x, y, rectW, rectH);
	}

	// Label
	const labelY = canvasHeight / 2 + rectH / dpr / 2 + stackOffset / dpr + 14;
	ctx.fillStyle = "#64748b";
	ctx.font = `${9 * dpr}px monospace`;
	ctx.textAlign = "center";
	const lines = layer.label.split("\n");
	lines.forEach((line, i) => {
		ctx.fillText(line, cx, (labelY + i * 12) * dpr);
	});

	// Output shape label
	const shapeLabel = layer.outputShape.join("×");
	ctx.fillStyle = "#475569";
	ctx.font = `${8 * dpr}px monospace`;
	ctx.fillText(shapeLabel, cx, (canvasHeight / 2 - rectH / dpr / 2 - 8) * dpr);
}

function drawEdges(
	ctx: CanvasRenderingContext2D,
	fromLayer: LayerGeometry,
	toLayer: LayerGeometry,
	weights: WeightSnapshot | undefined,
	dpr: number,
) {
	if (
		fromLayer.type === "conv2d" ||
		fromLayer.type === "maxPooling2d" ||
		toLayer.type === "conv2d" ||
		toLayer.type === "maxPooling2d"
	) {
		// Phase 2: draw a single arrow between conv blocks
		const fromX =
			"nodes" in fromLayer && fromLayer.nodes.length > 0
				? fromLayer.nodes[0].x
				: fromLayer.x;
		const toX =
			"nodes" in toLayer && toLayer.nodes.length > 0
				? toLayer.nodes[0].x
				: toLayer.x;
		const midY = ctx.canvas.height / dpr / 2;
		ctx.beginPath();
		ctx.moveTo(fromX * dpr, midY * dpr);
		ctx.lineTo(toX * dpr, midY * dpr);
		ctx.strokeStyle = "rgba(100,116,139,0.4)";
		ctx.lineWidth = dpr;
		ctx.stroke();
		return;
	}

	if (!("nodes" in fromLayer) || !("nodes" in toLayer)) return;

	const fromNodes = fromLayer.nodes;
	const toNodes = toLayer.nodes;

	// Draw all pairs, color by weight
	fromNodes.forEach((from, fi) => {
		toNodes.forEach((to, ti) => {
			let color = "rgba(100,116,139,0.08)";
			if (weights) {
				const wIdx = fi * toNodes.length + ti;
				const w = weights.weights[wIdx] ?? 0;
				color = weightColor(w);
			}
			ctx.beginPath();
			ctx.moveTo(from.x * dpr, from.y * dpr);
			ctx.lineTo(to.x * dpr, to.y * dpr);
			ctx.strokeStyle = color;
			ctx.lineWidth = dpr * 0.5;
			ctx.stroke();
		});
	});
}

function drawNetwork(
	ctx: CanvasRenderingContext2D,
	layout: NetworkLayout,
	weightSnapshots: WeightSnapshot[],
	dpr: number,
) {
	const { canvasWidth, canvasHeight, layers } = layout;
	ctx.clearRect(0, 0, canvasWidth * dpr, canvasHeight * dpr);

	// Background
	ctx.fillStyle = "#0f172a";
	ctx.fillRect(0, 0, canvasWidth * dpr, canvasHeight * dpr);

	// Build weight map by layer index
	const weightByLayer = new Map<number, WeightSnapshot>();
	for (const snap of weightSnapshots) {
		weightByLayer.set(snap.layerIndex, snap);
	}

	// Draw edges (behind nodes)
	for (let i = 0; i < layers.length - 1; i++) {
		const from = layers[i];
		const to = layers[i + 1];
		const weights = weightByLayer.get(to.layerIndex >= 0 ? to.layerIndex : -1);
		drawEdges(ctx, from, to, weights, dpr);
	}

	// Draw nodes
	for (const layer of layers) {
		if (layer.type === "conv2d" || layer.type === "maxPooling2d") {
			drawConvLayerGeometry(
				ctx,
				layer as Extract<LayerGeometry, { type: "conv2d" | "maxPooling2d" }>,
				canvasHeight,
				dpr,
			);
		} else {
			const denseLayer = layer as Extract<
				LayerGeometry,
				{ type: "dense" | "flatten" | "dropout" | "input" }
			>;
			const weights = weightByLayer.get(denseLayer.layerIndex);
			drawDenseLayerGeometry(ctx, denseLayer, weights, dpr);
		}
	}
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NetworkCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const weightsRef = useRef<WeightSnapshot[]>([]);
	const layoutRef = useRef<NetworkLayout | null>(null);
	const animFrameRef = useRef<number>(0);

	const layers = useArchitectureStore((s) => s.layers);
	const inputShape = useArchitectureStore((s) => s.inputShape);

	// Subscribe to weight snapshots outside of React's render cycle
	useEffect(() => {
		return useTrainingStore.subscribe((state) => {
			weightsRef.current = state.latestWeights;
		});
	}, []);

	// Recompute layout when architecture changes
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		layoutRef.current = computeNetworkLayout(
			layers,
			inputShape,
			rect.width,
			rect.height,
		);
	}, [layers, inputShape]);

	// rAF render loop — reads from refs, never triggers React re-renders
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;

		const render = () => {
			if (layoutRef.current) {
				drawNetwork(ctx, layoutRef.current, weightsRef.current, dpr);
			}
			animFrameRef.current = requestAnimationFrame(render);
		};
		animFrameRef.current = requestAnimationFrame(render);
		return () => cancelAnimationFrame(animFrameRef.current);
	}, []);

	// Handle canvas resize via ResizeObserver
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;

		const ro = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			if (width === 0 || height === 0) return;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			// Scale ctx so we can draw in logical pixels
			const ctx = canvas.getContext("2d");
			if (ctx) ctx.scale(dpr, dpr);
			layoutRef.current = computeNetworkLayout(
				layers,
				inputShape,
				width,
				height,
			);
		});
		ro.observe(canvas);
		return () => ro.disconnect();
	}, [layers, inputShape]);

	return (
		<canvas
			ref={canvasRef}
			className="w-full h-full cursor-crosshair"
			style={{ display: "block" }}
		/>
	);
}
