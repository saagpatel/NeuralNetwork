import LZString from "lz-string";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_TRAINING_CONFIG } from "@/constants/defaults";
import { PRESETS } from "@/constants/presets";
import type { LayerConfig, TrainingConfig } from "@/types";
import {
	decodeState,
	encodeState,
	getHashParam,
	setHashParam,
	type ShareableState,
} from "./url-state";

function encodeRaw(payload: unknown): string {
	return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

const validTraining: TrainingConfig = {
	...DEFAULT_TRAINING_CONFIG,
	maxTrainSamples: 1024,
};

const validDense: ShareableState = {
	layers: PRESETS[0].layers,
	inputShape: [28, 28, 1],
	datasetId: "mnist",
	trainingConfig: validTraining,
};

const validCnnLayers: LayerConfig[] = [
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
	{ type: "dense", units: 32, activation: "relu" },
	{ type: "dense", units: 10, activation: "softmax" },
];

const validCnn: ShareableState = {
	layers: validCnnLayers,
	inputShape: [32, 32, 3],
	datasetId: "cifar10",
	trainingConfig: {
		optimizer: "sgd",
		learningRate: 0.01,
		batchSize: 32,
		epochs: 5,
		validationSplit: 0.1,
		regularization: "l2",
		regularizationRate: 0.001,
	},
};

function validWith(
	overrides: Partial<ShareableState> & Record<string, unknown>,
): unknown {
	return {
		layers: validDense.layers,
		inputShape: validDense.inputShape,
		datasetId: validDense.datasetId,
		trainingConfig: validDense.trainingConfig,
		...overrides,
	};
}

afterEach(() => {
	window.location.hash = "";
});

describe("encodeState / decodeState", () => {
	it("encodes a dense state deterministically and round-trips deeply equal", () => {
		const first = encodeState(validDense);
		const second = encodeState(validDense);
		expect(first).toBe(second);
		expect(decodeState(first)).toEqual(validDense);
		expect(encodeState(decodeState(first)!)).toBe(first);
	});

	it("encodes a CNN state deterministically and round-trips deeply equal", () => {
		const first = encodeState(validCnn);
		const second = encodeState(validCnn);
		expect(first).toBe(second);
		expect(decodeState(first)).toEqual(validCnn);
		expect(encodeState(decodeState(first)!)).toBe(first);
	});

	it("returns null for malformed compressed input", () => {
		expect(decodeState("%%%not-valid%%%")).toBeNull();
		expect(decodeState("")).toBeNull();
	});

	it("returns null for malformed JSON", () => {
		expect(decodeState(encodeRaw("{"))).toBeNull();
		expect(
			decodeState(LZString.compressToEncodedURIComponent("not-json")),
		).toBeNull();
	});

	it("returns null for wrong container types", () => {
		expect(decodeState(encodeRaw(null))).toBeNull();
		expect(decodeState(encodeRaw([]))).toBeNull();
		expect(decodeState(encodeRaw("mnist"))).toBeNull();
		expect(decodeState(encodeRaw(1))).toBeNull();
	});

	it.each([
		{
			name: "missing field",
			payload: {
				layers: validDense.layers,
				inputShape: validDense.inputShape,
				datasetId: validDense.datasetId,
			},
		},
		{
			name: "extra field",
			payload: validWith({ extra: true }),
		},
		{
			name: "unknown dataset",
			payload: validWith({ datasetId: "imagenet" }),
		},
		{
			name: "mismatched input shape",
			payload: validWith({ inputShape: [32, 32, 3] }),
		},
		{
			name: "unknown layer type",
			payload: validWith({
				layers: [
					{ type: "lstm", units: 32 },
					{ type: "dense", units: 10, activation: "softmax" },
				],
			}),
		},
		{
			name: "invalid layer field/range",
			payload: validWith({
				layers: [
					{ type: "flatten" },
					{ type: "dense", units: 513, activation: "relu" },
					{ type: "dense", units: 10, activation: "softmax" },
				],
			}),
		},
		{
			name: "architecture error",
			payload: validWith({
				layers: [
					{
						type: "conv2d",
						filters: 8,
						kernelSize: 3,
						strides: 1,
						activation: "relu",
						padding: "same",
					},
					{ type: "dense", units: 10, activation: "softmax" },
				],
			}),
		},
		{
			name: "unknown optimizer",
			payload: validWith({
				trainingConfig: {
					...validTraining,
					optimizer: "nadam",
				},
			}),
		},
		{
			name: "invalid training field/range",
			payload: validWith({
				trainingConfig: {
					...validTraining,
					epochs: 0,
				},
			}),
		},
	])("returns null for $name", ({ payload }) => {
		expect(decodeState(encodeRaw(payload))).toBeNull();
	});
});

describe("hash params", () => {
	it("round-trips config through URLSearchParams", () => {
		const encoded = encodeState(validDense);
		setHashParam("config", encoded);
		expect(getHashParam("config")).toBe(encoded);
		expect(decodeState(getHashParam("config")!)).toEqual(validDense);
	});

	it("preserves an unrelated hash key when setting config", () => {
		window.location.hash = "theme=dark";
		const encoded = encodeState(validCnn);
		setHashParam("config", encoded);
		expect(getHashParam("theme")).toBe("dark");
		expect(getHashParam("config")).toBe(encoded);
	});
});
