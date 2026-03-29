import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type RightPanelTab = "loss" | "confusion" | "activations";

interface UIStore {
	selectedLayerIndex: number | null;
	architectPanelOpen: boolean;
	metricsPanelOpen: boolean;
	darkMode: boolean;
	snapshotEveryNBatches: number;
	overfittingMode: boolean;
	rightPanelTab: RightPanelTab;

	setSelectedLayer(index: number | null): void;
	toggleArchitectPanel(): void;
	toggleMetricsPanel(): void;
	toggleDarkMode(): void;
	setSnapshotRate(n: number): void;
	toggleOverfittingMode(): void;
	setRightPanelTab(tab: RightPanelTab): void;
}

export const useUIStore = create<UIStore>()(
	devtools(
		(set) => ({
			selectedLayerIndex: null,
			architectPanelOpen: true,
			metricsPanelOpen: true,
			darkMode: false,
			snapshotEveryNBatches: 10,
			overfittingMode: false,
			rightPanelTab: "loss" as RightPanelTab,

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

			setSnapshotRate(n) {
				set({ snapshotEveryNBatches: n }, false, "setSnapshotRate");
			},

			toggleOverfittingMode() {
				set(
					(state) => ({ overfittingMode: !state.overfittingMode }),
					false,
					"toggleOverfittingMode",
				);
			},

			setRightPanelTab(tab) {
				set({ rightPanelTab: tab }, false, "setRightPanelTab");
			},
		}),
		{ name: "ui-store" },
	),
);
