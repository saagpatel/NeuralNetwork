import * as tf from "@tensorflow/tfjs";
import type {
	LayerConfig,
	NetworkConfig,
	OptimizerType,
	TrainingConfig,
} from "@/types";

/**
 * Build a tf.layers.Layer from a LayerConfig.
 * The first layer in the network receives inputShape via the config.
 */
function buildLayer(
	config: LayerConfig,
	inputShape?: number[],
): tf.layers.Layer {
	const shapeArgs = inputShape ? { inputShape } : {};

	switch (config.type) {
		case "dense":
			return tf.layers.dense({
				units: config.units,
				activation: config.activation,
				...shapeArgs,
			});

		case "conv2d":
			return tf.layers.conv2d({
				filters: config.filters,
				kernelSize: config.kernelSize,
				strides: config.strides,
				activation: config.activation,
				padding: config.padding,
				...shapeArgs,
			});

		case "maxPooling2d":
			return tf.layers.maxPooling2d({
				poolSize: config.poolSize,
				strides: config.strides,
				...shapeArgs,
			});

		case "flatten":
			return tf.layers.flatten({ ...shapeArgs });

		case "dropout":
			return tf.layers.dropout({
				rate: config.rate,
				...shapeArgs,
			});
	}
}

/**
 * Map an OptimizerType + learningRate to a TF.js optimizer instance.
 */
function buildOptimizer(
	type: OptimizerType,
	learningRate: number,
): tf.Optimizer {
	switch (type) {
		case "adam":
			return tf.train.adam(learningRate);
		case "sgd":
			return tf.train.sgd(learningRate);
		case "rmsprop":
			return tf.train.rmsprop(learningRate);
		case "adagrad":
			return tf.train.adagrad(learningRate);
	}
}

/**
 * Compile a NetworkConfig + TrainingConfig into a ready-to-train tf.Sequential model.
 */
export function compileModel(
	networkConfig: NetworkConfig,
	trainingConfig: TrainingConfig,
): tf.Sequential {
	const model = tf.sequential();

	networkConfig.layers.forEach((layerConfig, i) => {
		const inputShape = i === 0 ? networkConfig.inputShape : undefined;
		model.add(buildLayer(layerConfig, inputShape));
	});

	const optimizer = buildOptimizer(
		trainingConfig.optimizer,
		trainingConfig.learningRate,
	);

	model.compile({
		loss: "categoricalCrossentropy",
		optimizer,
		metrics: ["accuracy"],
	});

	return model;
}

/**
 * Count trainable parameters in a compiled model.
 */
export function countParams(model: tf.Sequential): number {
	return model.countParams();
}
