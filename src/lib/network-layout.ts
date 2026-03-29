import { computeOutputShape } from "@/lib/architecture-validator";
import type { LayerConfig } from "@/types";

// ─── Geometry types ──────────────────────────────────────────────────────────

export interface NodeGeometry {
	x: number;
	y: number;
	radius: number;
}

export interface DenseLayerGeometry {
	type: "dense" | "flatten" | "dropout" | "input";
	layerIndex: number;
	x: number; // center x of the column
	width: number; // allocated column width
	nodes: NodeGeometry[]; // circles to draw (may be a compressed subset)
	visibleCount: number; // number of circles drawn
	totalCount: number; // actual neuron count (may be larger)
	label: string; // e.g. "Dense · 128 ReLU"
}

export interface FeatureMapGeometry {
	x: number;
	y: number;
	width: number;
	height: number;
	filterIndex: number;
}

export interface ConvLayerGeometry {
	type: "conv2d" | "maxPooling2d";
	layerIndex: number;
	x: number;
	width: number;
	featureMaps: FeatureMapGeometry[] | null;
	outputShape: number[]; // e.g. [26, 26, 32]
	kernelSize: number; // 0 for maxPooling2d
	filters: number; // 0 for maxPooling2d
	label: string; // e.g. "Conv2D · 32 filters 3×3"
}

export type LayerGeometry = DenseLayerGeometry | ConvLayerGeometry;

export interface NetworkLayout {
	canvasWidth: number;
	canvasHeight: number;
	layers: LayerGeometry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_VISIBLE_NODES = 20;
const MIN_NODE_GAP = 6; // px between node edges
const NODE_RADIUS = 8;
const COLUMN_PADDING = 24; // px between columns
const CANVAS_PADDING_Y = 48; // vertical padding top/bottom

// ─── Label helpers ────────────────────────────────────────────────────────────

function denseLabel(units: number, activation: string): string {
	return `Dense · ${units}\n${activation}`;
}

function convLabel(
	filters: number,
	kernelSize: number,
	activation: string,
): string {
	return `Conv2D · ${filters}f\n${kernelSize}×${kernelSize} ${activation}`;
}

function poolLabel(poolSize: number): string {
	return `MaxPool · ${poolSize}×${poolSize}`;
}

// ─── Node position computation ────────────────────────────────────────────────

function buildNodes(
	_totalCount: number,
	visibleCount: number,
	cx: number,
	canvasHeight: number,
): NodeGeometry[] {
	const usableHeight = canvasHeight - CANVAS_PADDING_Y * 2;
	// Space nodes evenly, clamped so they don't overflow
	const totalNodeHeight =
		visibleCount * NODE_RADIUS * 2 + (visibleCount - 1) * MIN_NODE_GAP;
	const actualHeight =
		visibleCount > 1
			? Math.min(totalNodeHeight, usableHeight)
			: NODE_RADIUS * 2;
	const startY = (canvasHeight - actualHeight) / 2 + NODE_RADIUS;

	const nodes: NodeGeometry[] = [];
	for (let i = 0; i < visibleCount; i++) {
		nodes.push({
			x: cx,
			y:
				startY + i * (visibleCount > 1 ? actualHeight / (visibleCount - 1) : 0),
			radius: NODE_RADIUS,
		});
	}
	return nodes;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Compute pixel layout for the network graph canvas.
 * Pure function — no side effects, no React/store imports.
 */
export function computeNetworkLayout(
	layers: LayerConfig[],
	inputShape: number[],
	canvasWidth: number,
	canvasHeight: number,
): NetworkLayout {
	// Build an augmented list: input representation + actual layers
	type Entry =
		| { kind: "input"; inputShape: number[] }
		| { kind: "layer"; config: LayerConfig; index: number };

	const entries: Entry[] = [
		{ kind: "input", inputShape },
		...layers.map((config, index) => ({
			kind: "layer" as const,
			config,
			index,
		})),
	];

	const totalCols = entries.length;
	const colWidth = (canvasWidth - COLUMN_PADDING * 2) / totalCols;

	const resultLayers: LayerGeometry[] = [];
	let currentInputShape = [...inputShape];

	for (let col = 0; col < entries.length; col++) {
		const entry = entries[col];
		const cx = COLUMN_PADDING + colWidth * col + colWidth / 2;
		const width = colWidth;

		if (entry.kind === "input") {
			// Compressed input: show 8 representative nodes regardless of input size
			const totalCount = inputShape.reduce((a, b) => a * b, 1);
			const visibleCount = Math.min(8, totalCount);
			const labelDims =
				inputShape.length === 3
					? `${inputShape[0]}×${inputShape[1]}×${inputShape[2]}`
					: `${totalCount}`;
			resultLayers.push({
				type: "input",
				layerIndex: -1,
				x: cx,
				width,
				nodes: buildNodes(totalCount, visibleCount, cx, canvasHeight),
				visibleCount,
				totalCount,
				label: `Input\n${labelDims}`,
			});
			continue;
		}

		const { config, index } = entry;

		if (config.type === "conv2d") {
			const outputShape = computeOutputShape(config, currentInputShape);
			resultLayers.push({
				type: "conv2d",
				layerIndex: index,
				x: cx,
				width,
				featureMaps: null,
				outputShape,
				kernelSize: config.kernelSize,
				filters: config.filters,
				label: convLabel(config.filters, config.kernelSize, config.activation),
			});
			currentInputShape = outputShape;
			continue;
		}

		if (config.type === "maxPooling2d") {
			const outputShape = computeOutputShape(config, currentInputShape);
			resultLayers.push({
				type: "maxPooling2d",
				layerIndex: index,
				x: cx,
				width,
				featureMaps: null,
				outputShape,
				kernelSize: 0,
				filters: 0,
				label: poolLabel(config.poolSize),
			});
			currentInputShape = outputShape;
			continue;
		}

		if (config.type === "flatten") {
			const flatShape = computeOutputShape(config, currentInputShape);
			const totalCount = flatShape[0] ?? 1;
			resultLayers.push({
				type: "flatten",
				layerIndex: index,
				x: cx,
				width,
				nodes: buildNodes(1, 1, cx, canvasHeight),
				visibleCount: 1,
				totalCount,
				label: "Flatten",
			});
			currentInputShape = flatShape;
			continue;
		}

		if (config.type === "dropout") {
			resultLayers.push({
				type: "dropout",
				layerIndex: index,
				x: cx,
				width,
				nodes: buildNodes(1, 1, cx, canvasHeight),
				visibleCount: 1,
				totalCount: 1,
				label: `Dropout\n${(config.rate * 100).toFixed(0)}%`,
			});
			continue;
		}

		// Dense
		const totalCount = config.units;
		const visibleCount = Math.min(totalCount, MAX_VISIBLE_NODES);
		resultLayers.push({
			type: "dense",
			layerIndex: index,
			x: cx,
			width,
			nodes: buildNodes(totalCount, visibleCount, cx, canvasHeight),
			visibleCount,
			totalCount,
			label: denseLabel(config.units, config.activation),
		});
	}

	return { canvasWidth, canvasHeight, layers: resultLayers };
}
