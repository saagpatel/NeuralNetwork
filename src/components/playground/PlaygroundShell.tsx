"use client";

import { useEffect } from "react";
import { initTFBackend } from "@/lib/backend-selector";
import type { RightPanelTab } from "@/stores/ui-store";
import { useUIStore } from "@/stores/ui-store";
import { terminateTrainingWorker } from "@/workers/training.api";
import { ActivationViewer } from "./ActivationViewer";
import { ConfusionMatrix } from "./ConfusionMatrix";
import { DatasetSelector } from "./DatasetSelector";
import { HyperparamPanel } from "./HyperparamPanel";
import { LossCurveChart } from "./LossCurveChart";
import { NetworkArchitect } from "./NetworkArchitect";
import { NetworkCanvas } from "./NetworkCanvas";
import { TrainingControls } from "./TrainingControls";

export function PlaygroundShell() {
	const darkMode = useUIStore((s) => s.darkMode);
	const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
	const architectPanelOpen = useUIStore((s) => s.architectPanelOpen);
	const toggleArchitectPanel = useUIStore((s) => s.toggleArchitectPanel);
	const metricsPanelOpen = useUIStore((s) => s.metricsPanelOpen);
	const toggleMetricsPanel = useUIStore((s) => s.toggleMetricsPanel);
	const rightPanelTab = useUIStore((s) => s.rightPanelTab);
	const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);

	const TABS: { id: RightPanelTab; label: string }[] = [
		{ id: "loss", label: "Loss" },
		{ id: "confusion", label: "Confusion" },
		{ id: "activations", label: "Activations" },
	];

	// Initialize TF.js backend on mount, terminate worker on unmount
	useEffect(() => {
		void initTFBackend();
		return () => {
			terminateTrainingWorker();
		};
	}, []);

	// Sync dark mode class on <html>
	useEffect(() => {
		document.documentElement.classList.toggle("dark", darkMode);
	}, [darkMode]);

	return (
		<div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
			{/* Header */}
			<header className="flex items-center justify-between px-4 h-12 border-b border-slate-800 flex-shrink-0">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={toggleArchitectPanel}
						className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
						title={
							architectPanelOpen
								? "Hide architect panel"
								: "Show architect panel"
						}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<rect x="1" y="2" width="5" height="12" rx="1" />
							<rect x="8" y="2" width="7" height="5" rx="1" />
							<rect x="8" y="9" width="7" height="5" rx="1" />
						</svg>
					</button>
					<h1 className="text-sm font-semibold tracking-tight text-slate-100">
						Neural Network Playground
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={toggleMetricsPanel}
						className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
						title={
							metricsPanelOpen ? "Hide metrics panel" : "Show metrics panel"
						}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path
								d="M1 12 L4 8 L7 10 L10 5 L13 7 L15 3"
								stroke="currentColor"
								strokeWidth="1.5"
								fill="none"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
					<button
						type="button"
						onClick={toggleDarkMode}
						className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
						title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
					>
						{darkMode ? (
							<svg
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="currentColor"
							>
								<circle cx="8" cy="8" r="3.5" />
								<path
									d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						) : (
							<svg
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="currentColor"
							>
								<path d="M12 8a5 5 0 1 1-9.9-1.1A4 4 0 0 0 9.1 2.1 5 5 0 0 1 12 8z" />
							</svg>
						)}
					</button>
				</div>
			</header>

			{/* Main area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left panel */}
				<aside
					className={[
						"flex flex-col border-r border-slate-800 overflow-y-auto flex-shrink-0",
						"transition-all duration-200 ease-in-out",
						architectPanelOpen ? "w-72" : "w-0 overflow-hidden",
					].join(" ")}
				>
					<div className="flex flex-col gap-0 min-w-[288px]">
						<DatasetSelector />
						<div className="border-t border-slate-800" />
						<NetworkArchitect />
						<div className="border-t border-slate-800" />
						<HyperparamPanel />
					</div>
				</aside>

				{/* Center canvas */}
				<main className="flex-1 overflow-hidden bg-slate-950">
					<NetworkCanvas />
				</main>

				{/* Right panel */}
				<aside
					className={[
						"flex flex-col border-l border-slate-800 overflow-y-auto flex-shrink-0",
						"transition-all duration-200 ease-in-out",
						metricsPanelOpen ? "w-80" : "w-0 overflow-hidden",
					].join(" ")}
				>
					<div className="min-w-[320px] flex flex-col h-full">
						{/* Tab bar */}
						<div className="flex border-b border-slate-800 flex-shrink-0">
							{TABS.map((tab) => (
								<button
									key={tab.id}
									type="button"
									onClick={() => setRightPanelTab(tab.id)}
									className={[
										"px-3 py-2 text-xs transition-colors",
										rightPanelTab === tab.id
											? "text-slate-200 border-b-2 border-blue-500"
											: "text-slate-500 hover:text-slate-300",
									].join(" ")}
								>
									{tab.label}
								</button>
							))}
						</div>
						{/* Tab content */}
						<div className="flex-1 overflow-hidden">
							{rightPanelTab === "loss" && <LossCurveChart />}
							{rightPanelTab === "confusion" && <ConfusionMatrix />}
							{rightPanelTab === "activations" && <ActivationViewer />}
						</div>
					</div>
				</aside>
			</div>

			{/* Bottom training controls bar */}
			<footer className="flex-shrink-0 border-t border-slate-800">
				<TrainingControls />
			</footer>
		</div>
	);
}
