import * as tf from "@tensorflow/tfjs";

/**
 * Build a multi-output functional model exposing all intermediate layer outputs.
 * Used to extract per-layer activations for a given input sample.
 */
export function buildActivationModel(model: tf.LayersModel): tf.LayersModel {
	const inputs = model.inputs;
	const outputs = model.layers.map((l) => {
		const out = l.output;
		return (Array.isArray(out) ? out[0] : out) as tf.SymbolicTensor;
	});

	return tf.model({ inputs, outputs });
}
