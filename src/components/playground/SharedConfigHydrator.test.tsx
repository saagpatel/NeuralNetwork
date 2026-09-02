import { cleanup, render, screen, waitFor } from "@testing-library/react";
import LZString from "lz-string";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DATASET_ID, DEFAULT_TRAINING_CONFIG } from "@/constants/defaults";
import { PRESETS } from "@/constants/presets";
import {
	encodeState,
	setHashParam,
	type ShareableState,
} from "@/lib/url-state";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import { useUIStore } from "@/stores/ui-store";
import type { MetricsHistoryPoint, WeightSnapshot } from "@/types";
import { SharedConfigHydrator } from "./SharedConfigHydrator";

const validDense: ShareableState = {
	layers: PRESETS[0].layers,
	inputShape: [28, 28, 1],
	datasetId: "mnist",
	trainingConfig: { ...DEFAULT_TRAINING_CONFIG, maxTrainSamples: 512 },
};

const validCnn: ShareableState = {
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
		{ type: "dense", units: 32, activation: "relu" },
		{ type: "dense", units: 10, activation: "softmax" },
	],
	inputShape: [32, 32, 3],
	datasetId: "cifar10",
	trainingConfig: {
		optimizer: "rmsprop",
		learningRate: 0.0005,
		batchSize: 16,
		epochs: 3,
		validationSplit: 0.3,
		regularization: "l1",
		regularizationRate: 0.01,
	},
};

function dataSnapshot(state: object): Record<string, unknown> {
	const data: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(state)) {
		if (typeof value !== "function") {
			data[key] = value;
		}
	}
	return structuredClone(data);
}

function resetStores() {
	useArchitectureStore.setState({
		layers: PRESETS[0].layers,
		inputShape: [28, 28, 1],
	});
	useTrainingStore.setState({
		status: "idle",
		currentEpoch: 0,
		currentBatch: 0,
		totalBatches: 0,
		metricsHistory: [],
		latestWeights: [],
		latestConfusionMatrix: null,
		errorMessage: null,
		datasetId: DEFAULT_DATASET_ID,
		trainingConfig: { ...DEFAULT_TRAINING_CONFIG },
		datasetLoadProgress: 0,
	});
	useUIStore.setState({
		selectedLayerIndex: null,
		architectPanelOpen: true,
		metricsPanelOpen: true,
		darkMode: true,
		snapshotEveryNBatches: 10,
		overfittingMode: false,
		rightPanelTab: "loss",
		activeTutorialId: null,
		tutorialStep: 0,
	});
}

function spyShareableSetters() {
	const architecture = useArchitectureStore.getState();
	const training = useTrainingStore.getState();
	return {
		setLayers: vi.spyOn(architecture, "setLayers"),
		setInputShape: vi.spyOn(architecture, "setInputShape"),
		addLayer: vi.spyOn(architecture, "addLayer"),
		removeLayer: vi.spyOn(architecture, "removeLayer"),
		updateLayer: vi.spyOn(architecture, "updateLayer"),
		loadPreset: vi.spyOn(architecture, "loadPreset"),
		setDatasetId: vi.spyOn(training, "setDatasetId"),
		setTrainingConfig: vi.spyOn(training, "setTrainingConfig"),
		setDataset: vi.spyOn(training, "setDataset"),
		setStatus: vi.spyOn(training, "setStatus"),
		setProgress: vi.spyOn(training, "setProgress"),
		appendMetrics: vi.spyOn(training, "appendMetrics"),
		setWeights: vi.spyOn(training, "setWeights"),
		setConfusionMatrix: vi.spyOn(training, "setConfusionMatrix"),
		setError: vi.spyOn(training, "setError"),
		updateTrainingConfig: vi.spyOn(training, "updateTrainingConfig"),
		setDatasetLoadProgress: vi.spyOn(training, "setDatasetLoadProgress"),
		reset: vi.spyOn(training, "reset"),
	};
}

beforeEach(() => {
	resetStores();
	window.location.hash = "";
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	resetStores();
	window.location.hash = "";
});

describe("SharedConfigHydrator", () => {
	it("ignores an invalid hash, leaves stores unchanged, and renders a notice", async () => {
		const metrics: MetricsHistoryPoint[] = [
			{
				epoch: 2,
				trainLoss: 0.4,
				trainAccuracy: 0.8,
				valLoss: 0.5,
				valAccuracy: 0.75,
			},
		];
		const weights: WeightSnapshot[] = [
			{
				layerIndex: 1,
				layerName: "dense_1",
				weights: new Float32Array([0.2, -0.1]),
				biases: new Float32Array([0.01]),
				shape: [2],
			},
		];
		useArchitectureStore.setState({
			layers: PRESETS[1].layers,
			inputShape: [28, 28, 1],
		});
		useTrainingStore.setState({
			status: "paused",
			currentEpoch: 4,
			currentBatch: 7,
			totalBatches: 20,
			metricsHistory: metrics,
			latestWeights: weights,
			latestConfusionMatrix: [
				[3, 1],
				[0, 2],
			],
			errorMessage: "stale",
			datasetId: "fashion-mnist",
			trainingConfig: { ...DEFAULT_TRAINING_CONFIG, epochs: 12 },
			datasetLoadProgress: 0.6,
		});
		useUIStore.setState({
			selectedLayerIndex: 2,
			darkMode: false,
			rightPanelTab: "confusion",
			overfittingMode: true,
		});

		const beforeArchitecture = dataSnapshot(useArchitectureStore.getState());
		const beforeTraining = dataSnapshot(useTrainingStore.getState());
		const beforeUi = dataSnapshot(useUIStore.getState());
		const spies = spyShareableSetters();

		const invalidEncoded = LZString.compressToEncodedURIComponent(
			JSON.stringify({
				layers: validDense.layers,
				inputShape: validDense.inputShape,
				datasetId: validDense.datasetId,
				trainingConfig: {
					...validDense.trainingConfig,
					optimizer: "nadam",
				},
			}),
		);
		setHashParam("other", "keep-me");
		setHashParam("config", invalidEncoded);

		render(
			<StrictMode>
				<SharedConfigHydrator />
			</StrictMode>,
		);

		await waitFor(() => {
			expect(screen.getByRole("status").textContent).toContain(
				"Shared configuration ignored",
			);
		});

		expect(dataSnapshot(useArchitectureStore.getState())).toEqual(
			beforeArchitecture,
		);
		expect(dataSnapshot(useTrainingStore.getState())).toEqual(beforeTraining);
		expect(dataSnapshot(useUIStore.getState())).toEqual(beforeUi);
		expect(spies.setLayers).not.toHaveBeenCalled();
		expect(spies.setInputShape).not.toHaveBeenCalled();
		expect(spies.setDatasetId).not.toHaveBeenCalled();
		expect(spies.setTrainingConfig).not.toHaveBeenCalled();
		expect(spies.reset).not.toHaveBeenCalled();
		expect(spies.setStatus).not.toHaveBeenCalled();
		expect(new URLSearchParams(window.location.hash.slice(1)).get("other")).toBe(
			"keep-me",
		);
	});

	it("applies only the four shareable fields once under Strict Mode and preserves non-shareable state", async () => {
		const metrics: MetricsHistoryPoint[] = [
			{
				epoch: 1,
				trainLoss: 1.2,
				trainAccuracy: 0.4,
				valLoss: 1.3,
				valAccuracy: 0.35,
			},
		];
		const weights: WeightSnapshot[] = [
			{
				layerIndex: 0,
				layerName: "conv2d_1",
				weights: new Float32Array([1, 2, 3]),
				biases: new Float32Array([0.5]),
				shape: [3],
			},
		];

		useTrainingStore.setState({
			status: "training",
			currentEpoch: 6,
			currentBatch: 9,
			totalBatches: 40,
			metricsHistory: metrics,
			latestWeights: weights,
			latestConfusionMatrix: [[9, 1], [2, 8]],
			errorMessage: "keep-error",
			datasetLoadProgress: 0.85,
		});
		useUIStore.setState({
			selectedLayerIndex: 1,
			architectPanelOpen: false,
			metricsPanelOpen: false,
			darkMode: false,
			snapshotEveryNBatches: 3,
			overfittingMode: true,
			rightPanelTab: "activations",
			activeTutorialId: "intro",
			tutorialStep: 2,
		});

		const beforeTraining = dataSnapshot(useTrainingStore.getState());
		const beforeUi = dataSnapshot(useUIStore.getState());
		const spies = spyShareableSetters();

		setHashParam("view", "canvas");
		setHashParam("config", encodeState(validCnn));

		render(
			<StrictMode>
				<SharedConfigHydrator />
			</StrictMode>,
		);

		await waitFor(() => {
			expect(useArchitectureStore.getState().layers).toEqual(validCnn.layers);
		});

		expect(spies.setLayers).toHaveBeenCalledOnce();
		expect(spies.setInputShape).toHaveBeenCalledOnce();
		expect(spies.setDatasetId).toHaveBeenCalledOnce();
		expect(spies.setTrainingConfig).toHaveBeenCalledOnce();
		expect(spies.setLayers).toHaveBeenCalledWith(validCnn.layers);
		expect(spies.setInputShape).toHaveBeenCalledWith(validCnn.inputShape);
		expect(spies.setDatasetId).toHaveBeenCalledWith(validCnn.datasetId);
		expect(spies.setTrainingConfig).toHaveBeenCalledWith(validCnn.trainingConfig);

		expect(spies.addLayer).not.toHaveBeenCalled();
		expect(spies.removeLayer).not.toHaveBeenCalled();
		expect(spies.updateLayer).not.toHaveBeenCalled();
		expect(spies.loadPreset).not.toHaveBeenCalled();
		expect(spies.setDataset).not.toHaveBeenCalled();
		expect(spies.setStatus).not.toHaveBeenCalled();
		expect(spies.setProgress).not.toHaveBeenCalled();
		expect(spies.appendMetrics).not.toHaveBeenCalled();
		expect(spies.setWeights).not.toHaveBeenCalled();
		expect(spies.setConfusionMatrix).not.toHaveBeenCalled();
		expect(spies.setError).not.toHaveBeenCalled();
		expect(spies.updateTrainingConfig).not.toHaveBeenCalled();
		expect(spies.setDatasetLoadProgress).not.toHaveBeenCalled();
		expect(spies.reset).not.toHaveBeenCalled();

		expect(useArchitectureStore.getState().inputShape).toEqual(validCnn.inputShape);
		expect(useTrainingStore.getState().datasetId).toBe(validCnn.datasetId);
		expect(useTrainingStore.getState().trainingConfig).toEqual(
			validCnn.trainingConfig,
		);

		const afterTraining = dataSnapshot(useTrainingStore.getState());
		expect(afterTraining.status).toBe(beforeTraining.status);
		expect(afterTraining.currentEpoch).toBe(beforeTraining.currentEpoch);
		expect(afterTraining.currentBatch).toBe(beforeTraining.currentBatch);
		expect(afterTraining.totalBatches).toBe(beforeTraining.totalBatches);
		expect(afterTraining.metricsHistory).toEqual(beforeTraining.metricsHistory);
		expect(afterTraining.latestWeights).toEqual(beforeTraining.latestWeights);
		expect(afterTraining.latestConfusionMatrix).toEqual(
			beforeTraining.latestConfusionMatrix,
		);
		expect(afterTraining.errorMessage).toBe(beforeTraining.errorMessage);
		expect(afterTraining.datasetLoadProgress).toBe(
			beforeTraining.datasetLoadProgress,
		);
		expect(dataSnapshot(useUIStore.getState())).toEqual(beforeUi);
		expect(screen.queryByRole("status")).toBeNull();
		expect(new URLSearchParams(window.location.hash.slice(1)).get("view")).toBe(
			"canvas",
		);
	});
});
