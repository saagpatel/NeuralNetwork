import * as tf from "@tensorflow/tfjs";
import type { LayerActivation } from "@/types";

/**
 * Build a multi-output functional model exposing all intermediate layer outputs.
 * Used to extract per-layer activations for a given input sample.
 */
export function buildActivationModel(model: tf.LayersModel): tf.LayersModel {
	const inputs = model.inputs;
	const outputs = model.layers
		.filter((l) => l.name !== model.layers[0].name)
		.map((l) => {
			const out = l.output;
			return (Array.isArray(out) ? out[0] : out) as tf.SymbolicTensor;
		});

	return tf.model({ inputs, outputs });
}

/**
 * Run inference through the activation model and return per-layer activations.
 * Caller is responsible for disposing the input tensor.
 */
export async function extractActivations(
	activationModel: tf.LayersModel,
	sample: tf.Tensor,
): Promise<LayerActivation[]> {
	const outputs = activationModel.predict(sample);
	const outputList = Array.isArray(outputs) ? outputs : [outputs];

	const activations = await Promise.all(
		outputList.map(async (tensor, i) => {
			const layer = activationModel.layers[i + 1];
			const data = await tensor.data();
			return {
				layerIndex: i,
				layerName: layer?.name ?? `layer_${i}`,
				shape: tensor.shape.slice(1) as number[],
				data: data as Float32Array,
			};
		}),
	);

	outputList.forEach((t) => t.dispose());

	return activations;
}
