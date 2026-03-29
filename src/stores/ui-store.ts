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
	activeTutorialId: string | null;
	tutorialStep: number;

	setSelectedLayer(index: number | null): void;
	toggleArchitectPanel(): void;
	toggleMetricsPanel(): void;
	toggleDarkMode(): void;
	setSnapshotRate(n: number): void;
	toggleOverfittingMode(): void;
	setRightPanelTab(tab: RightPanelTab): void;
	setActiveTutorial(id: string | null): void;
	setTutorialStep(step: number): void;
}

export const useUIStore = create<UIStore>()(
	devtools(
		(set) => ({
			selectedLayerIndex: null,
			architectPanelOpen: true,
			metricsPanelOpen: true,
			darkMode: true,
			snapshotEveryNBatches: 10,
			overfittingMode: false,
			rightPanelTab: "loss" as RightPanelTab,
			activeTutorialId: null as string | null,
			tutorialStep: 0,

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
					(state) => {
						const next = !state.darkMode;
						if (typeof window !== "undefined") {
							localStorage.setItem("darkMode", String(next));
						}
						return { darkMode: next };
					},
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

			setActiveTutorial(id) {
				set(
					{ activeTutorialId: id, tutorialStep: 0 },
					false,
					"setActiveTutorial",
				);
			},

			setTutorialStep(step) {
				set({ tutorialStep: step }, false, "setTutorialStep");
			},
		}),
		{ name: "ui-store" },
	),
);
