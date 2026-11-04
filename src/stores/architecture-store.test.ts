import { beforeEach, describe, expect, it } from "vitest";
import { MAX_NETWORK_LAYERS } from "@/constants/network";
import type { LayerConfig } from "@/types";
import { useArchitectureStore } from "./architecture-store";
import { useTrainingStore } from "./training-store";

const denseLayer: LayerConfig = {
	type: "dense",
	units: 2,
	activation: "relu",
};

describe("architecture store layer limit", () => {
	beforeEach(() => {
		useArchitectureStore
			.getState()
			.setLayers(Array.from({ length: MAX_NETWORK_LAYERS }, () => denseLayer));
	});

	it("does not create a network that its share decoder would reject", () => {
		useArchitectureStore.getState().addLayer(denseLayer);

		expect(useArchitectureStore.getState().layers).toHaveLength(
			MAX_NETWORK_LAYERS,
		);
	});
});

describe("applyPreset", () => {
	it("applies the Deep CNN shape and recommended dataset together", () => {
		useArchitectureStore.getState().applyPreset("deep-cnn");

		expect(useArchitectureStore.getState().inputShape).toEqual([32, 32, 3]);
		expect(useTrainingStore.getState().datasetId).toBe("cifar10");
	});
});
