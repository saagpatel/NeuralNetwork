import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface UIStore {
	selectedLayerIndex: number | null;
	architectPanelOpen: boolean;
	metricsPanelOpen: boolean;
	darkMode: boolean;
	snapshotEveryNBatches: number;
	overfittingMode: boolean;
	activationViewerOpen: boolean; // Phase 2 stub

	setSelectedLayer(index: number | null): void;
	toggleArchitectPanel(): void;
	toggleMetricsPanel(): void;
	toggleDarkMode(): void;
	setSnapshotRate(n: number): void;
	toggleOverfittingMode(): void;
	toggleActivationViewer(): void; // Phase 2 stub
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
			activationViewerOpen: false,

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

			toggleActivationViewer() {
				set(
					(state) => ({ activationViewerOpen: !state.activationViewerOpen }),
					false,
					"toggleActivationViewer",
				);
			},
		}),
		{ name: "ui-store" },
	),
);
