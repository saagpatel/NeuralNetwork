import type { LayerConfig } from "@/types";

export interface ValidationError {
	layerIndex: number | null; // null = whole-architecture error
	message: string;
	severity: "error" | "warning";
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
