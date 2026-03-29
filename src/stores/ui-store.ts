import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface UIStore {
	selectedLayerIndex: number | null;
	architectPanelOpen: boolean;
	metricsPanelOpen: boolean;
	darkMode: boolean;

	setSelectedLayer(index: number | null): void;
	toggleArchitectPanel(): void;
	toggleMetricsPanel(): void;
	toggleDarkMode(): void;
}

export const useUIStore = create<UIStore>()(
	devtools(
		(set) => ({
			selectedLayerIndex: null,
			architectPanelOpen: true,
			metricsPanelOpen: true,
			darkMode: false,

			setSelectedLayer(index) {
				set({ selectedLayerIndex: index }, false, "setSelectedLayer");
			},

			toggleArchitectPanel() {
				set(
					(state) => ({ architectPanelOpen: !state.architectPanelOpen }),
					false,
					"toggleArchitectPanel",
				);
			},

			toggleMetricsPanel() {
				set(
					(state) => ({ metricsPanelOpen: !state.metricsPanelOpen }),
					false,
					"toggleMetricsPanel",
				);
			},

			toggleDarkMode() {
				set(
					(state) => ({ darkMode: !state.darkMode }),
					false,
					"toggleDarkMode",
				);
			},
		}),
		{ name: "ui-store" },
	),
);
