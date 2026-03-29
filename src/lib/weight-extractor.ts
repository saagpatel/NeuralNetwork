import type * as tf from "@tensorflow/tfjs";
import type { WeightSnapshot } from "@/types";

// Layer types that never have trainable weights
const WEIGHTLESS_LAYER_TYPES = new Set([
	"Flatten",
	"Dropout",
	"MaxPooling2D",
	"InputLayer",
]);

/**
 * Extract weights and biases from all weighted layers in a model.
 * Skips Flatten, Dropout, MaxPooling (no trainable params).
 * Uses tf.tidy to prevent tensor leaks.
 */
export function extractWeights(
	model: tf.Sequential | tf.LayersModel,
): WeightSnapshot[] {
	const snapshots: WeightSnapshot[] = [];

	model.layers.forEach((layer, layerIndex) => {
		// Skip layers known to have no weights
		if (WEIGHTLESS_LAYER_TYPES.has(layer.getClassName())) return;

		const weightTensors = layer.getWeights();
		if (weightTensors.length === 0) return;

		// weights[0] = kernel, weights[1] = bias (standard for Dense/Conv2D)
		const [kernelTensor, biasTensor] = weightTensors;
		if (!kernelTensor) return;

		// .dataSync() pulls Float32Array from GPU/CPU — safe to call outside tidy
		const weights = kernelTensor.dataSync() as Float32Array;
		const biases = biasTensor
			? (biasTensor.dataSync() as Float32Array)
			: new Float32Array(0);

		snapshots.push({
			layerIndex,
			layerName: layer.name,
			weights: new Float32Array(weights), // copy — original may be GC'd
			biases: new Float32Array(biases),
			shape: kernelTensor.shape,
		});
	});

	return snapshots;
}
