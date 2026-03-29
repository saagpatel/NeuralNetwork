import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { PRESETS } from "@/constants/presets";
import type { LayerConfig } from "@/types";

interface ArchitectureStore {
	layers: LayerConfig[];
	inputShape: number[];

	addLayer(layer: LayerConfig, atIndex?: number): void;
	removeLayer(index: number): void;
	updateLayer(index: number, update: Partial<LayerConfig>): void;
	loadPreset(presetId: string): void;
	setInputShape(shape: number[]): void;
	setLayers(layers: LayerConfig[]): void;
}

export const useArchitectureStore = create<ArchitectureStore>()(
	devtools(
		(set) => ({
			// Default: Simple Dense preset for MNIST
			layers: PRESETS[0].layers,
			inputShape: [28, 28, 1],

			addLayer(layer, atIndex) {
				set(
					(state) => {
						const next = [...state.layers];
						if (atIndex !== undefined) {
							next.splice(atIndex, 0, layer);
						} else {
							next.push(layer);
						}
						return { layers: next };
					},
					false,
					"addLayer",
				);
			},

			removeLayer(index) {
				set(
					(state) => ({
						layers: state.layers.filter((_, i) => i !== index),
					}),
					false,
					"removeLayer",
				);
			},

			updateLayer(index, update) {
				set(
					(state) => {
						const next = [...state.layers];
						next[index] = { ...next[index], ...update } as LayerConfig;
						return { layers: next };
					},
					false,
					"updateLayer",
				);
			},

			loadPreset(presetId) {
				const preset = PRESETS.find((p) => p.id === presetId);
				if (!preset) return;
				set({ layers: preset.layers }, false, "loadPreset");
			},

			setInputShape(shape) {
				set({ inputShape: shape }, false, "setInputShape");
			},

			setLayers(layers) {
				set({ layers }, false, "setLayers");
			},
		}),
		{ name: "architecture-store" },
	),
);
