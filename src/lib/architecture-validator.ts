import type { LayerConfig } from "@/types";

export interface ValidationError {
	layerIndex: number | null; // null = whole-architecture error
	message: string;
	severity: "error" | "warning";
}

export function computeOutputShape(
	layer: LayerConfig,
	inputShape: number[],
): number[] {
	if (layer.type === "conv2d") {
		const [H, W] = inputShape;
		const { filters, kernelSize, strides, padding } = layer;
		if (padding === "same") {
			return [Math.ceil(H / strides), Math.ceil(W / strides), filters];
		}
		return [
			Math.floor((H - kernelSize) / strides) + 1,
			Math.floor((W - kernelSize) / strides) + 1,
			filters,
		];
	}
	if (layer.type === "maxPooling2d") {
		const [H, W, C] = inputShape;
		const ps = layer.poolSize;
		return [Math.floor(H / ps), Math.floor(W / ps), C];
	}
	if (layer.type === "flatten") {
		return [inputShape.reduce((a, b) => a * b, 1)];
	}
	if (layer.type === "dense") {
		return [layer.units];
	}
	return inputShape;
}

/**
 * Validate a network architecture before compilation.
 *
 * Phase 1 rules cover dense-focused architectures.
 * Phase 2 will add CNN-specific rules (Dense after Conv without Flatten,
 * MaxPool dimension collapse, etc.) to this same function — all callers
 * are unchanged.
 */
export function validateArchitecture(
	layers: LayerConfig[],
	inputShape: number[],
): ValidationError[] {
	const errors: ValidationError[] = [];

	// Rule 1: must have at least one layer
	if (layers.length === 0) {
		errors.push({
			layerIndex: null,
			message: "Network must have at least one layer.",
			severity: "error",
		});
		return errors; // nothing else to check
	}

	// Rule 2: last layer must be Dense with softmax
	const last = layers[layers.length - 1];
	if (last.type !== "dense" || last.activation !== "softmax") {
		errors.push({
			layerIndex: layers.length - 1,
			message: "Last layer must be a Dense layer with softmax activation.",
			severity: "error",
		});
	}

	// Rule 3: if input is 2D image (rank-3 shape), first layer should flatten or conv
	if (inputShape.length === 3) {
		const first = layers[0];
		if (first.type !== "flatten" && first.type !== "conv2d") {
			errors.push({
				layerIndex: 0,
				message:
					"Input shape is 2D (e.g. 28×28×1). First layer should be Flatten or Conv2D.",
				severity: "warning",
			});
		}
	}

	// CNN structural rules: spatial mode tracking
	if (inputShape.length === 3 || layers.some((l) => l.type === "conv2d")) {
		type ShapeMode = "spatial" | "flat";
		let mode: ShapeMode = inputShape.length === 3 ? "spatial" : "flat";
		let currentShape: number[] = [...inputShape];
		let hasConv = false;

		layers.forEach((layer, i) => {
			if (layer.type === "conv2d") {
				if (mode === "flat") {
					errors.push({
						layerIndex: i,
						message: "Conv2D cannot follow a Flatten layer.",
						severity: "error",
					});
				}
				hasConv = true;
				currentShape = computeOutputShape(layer, currentShape);
			} else if (layer.type === "maxPooling2d") {
				if (mode === "flat") {
					errors.push({
						layerIndex: i,
						message: "MaxPooling2D cannot follow a Flatten layer.",
						severity: "error",
					});
				} else if (!hasConv) {
					errors.push({
						layerIndex: i,
						message: "MaxPooling2D should follow a Conv2D layer.",
						severity: "warning",
					});
				}
				if (mode === "spatial") {
					const next = computeOutputShape(layer, currentShape);
					if (next[0] < 1 || next[1] < 1) {
						errors.push({
							layerIndex: i,
							message: `MaxPooling2D collapses spatial dimensions to zero (${currentShape[0]}×${currentShape[1]} → ${next[0]}×${next[1]}).`,
							severity: "error",
						});
					}
					currentShape = next;
				}
			} else if (layer.type === "flatten") {
				mode = "flat";
				currentShape = computeOutputShape(layer, currentShape);
			} else if (layer.type === "dense") {
				if (mode === "spatial") {
					errors.push({
						layerIndex: i,
						message:
							"Dense layer cannot follow Conv2D/MaxPooling2D without a Flatten layer.",
						severity: "error",
					});
				}
			}
		});
	}

	// Per-layer rules
	layers.forEach((layer, i) => {
		if (layer.type === "dense") {
			if (layer.units < 2) {
				errors.push({
					layerIndex: i,
					message: `Dense layer must have at least 2 units (got ${layer.units}).`,
					severity: "error",
				});
			}
		}

		if (layer.type === "dropout") {
			if (layer.rate <= 0 || layer.rate >= 1) {
				errors.push({
					layerIndex: i,
					message: `Dropout rate must be between 0 and 1 exclusive (got ${layer.rate}).`,
					severity: "error",
				});
			}
		}
	});

	return errors;
}
