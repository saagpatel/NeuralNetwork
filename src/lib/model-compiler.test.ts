import * as tf from "@tensorflow/tfjs";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_TRAINING_CONFIG } from "@/constants/defaults";
import type { NetworkConfig, TrainingConfig } from "@/types";
import { compileModel, countParams } from "./model-compiler";

// TF.js needs a backend — use CPU for tests
beforeAll(async () => {
	await tf.setBackend("cpu");
	await tf.ready();
});

const defaultTrainingConfig: TrainingConfig = {
	...DEFAULT_TRAINING_CONFIG,
	optimizer: "adam",
	learningRate: 0.001,
};

describe("compileModel", () => {
	it("compiles Simple Dense [flatten→128→10] with correct param count", () => {
		const config: NetworkConfig = {
			inputShape: [28, 28, 1],
			layers: [
				{ type: "flatten" },
				{ type: "dense", units: 128, activation: "relu" },
				{ type: "dense", units: 10, activation: "softmax" },
			],
		};

		const model = compileModel(config, defaultTrainingConfig);
		// 784×128 + 128 (bias) + 128×10 + 10 (bias) = 100352 + 128 + 1280 + 10 = 101770
		expect(countParams(model)).toBe(101770);
		model.dispose();
	});

	it("compiles Deep Dense with correct layer count", () => {
		const config: NetworkConfig = {
			inputShape: [28, 28, 1],
			layers: [
				{ type: "flatten" },
				{ type: "dense", units: 256, activation: "relu" },
				{ type: "dense", units: 128, activation: "relu" },
				{ type: "dense", units: 64, activation: "relu" },
				{ type: "dense", units: 10, activation: "softmax" },
			],
		};

		const model = compileModel(config, defaultTrainingConfig);
		// Count trainable layers (excluding input layer added by TF.js)
		const trainableLayers = model.layers.filter(
			(l) => l.getWeights().length > 0,
		);
		expect(trainableLayers).toHaveLength(4); // 4 dense layers
		model.dispose();
	});

	it("compiles all 5 layer types without throwing", () => {
		const config: NetworkConfig = {
			inputShape: [28, 28, 1],
			layers: [
				{
					type: "conv2d",
					filters: 8,
					kernelSize: 3,
					strides: 1,
					activation: "relu",
					padding: "same",
				},
				{ type: "maxPooling2d", poolSize: 2, strides: 2 },
				{ type: "flatten" },
				{ type: "dropout", rate: 0.25 },
				{ type: "dense", units: 10, activation: "softmax" },
			],
		};

		expect(() => compileModel(config, defaultTrainingConfig)).not.toThrow();
		const model = compileModel(config, defaultTrainingConfig);
		model.dispose();
	});

	it("compiles with all optimizer types", () => {
		const baseConfig: NetworkConfig = {
			inputShape: [28, 28, 1],
			layers: [
				{ type: "flatten" },
				{ type: "dense", units: 10, activation: "softmax" },
			],
		};

		const optimizers = ["adam", "sgd", "rmsprop", "adagrad"] as const;
		for (const optimizer of optimizers) {
			const model = compileModel(baseConfig, {
				...defaultTrainingConfig,
				optimizer,
			});
			expect(model).toBeDefined();
			model.dispose();
		}
	});

	it("compiles with all supported activation functions", () => {
		const activations = [
			"relu",
			"sigmoid",
			"tanh",
			"linear",
			"elu",
			"selu",
			"swish",
		] as const;

		for (const activation of activations) {
			const config: NetworkConfig = {
				inputShape: [4],
				layers: [
					{ type: "dense", units: 8, activation },
					{ type: "dense", units: 2, activation: "softmax" },
				],
			};
			expect(() => compileModel(config, defaultTrainingConfig)).not.toThrow();
			const model = compileModel(config, defaultTrainingConfig);
			model.dispose();
		}
	});
});
