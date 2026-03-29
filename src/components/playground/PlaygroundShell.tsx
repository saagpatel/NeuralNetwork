"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { TUTORIALS } from "@/constants/tutorials";
import { initTFBackend } from "@/lib/backend-selector";
import {
	decodeState,
	encodeState,
	getHashParam,
	setHashParam,
} from "@/lib/url-state";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useTrainingStore } from "@/stores/training-store";
import type { RightPanelTab } from "@/stores/ui-store";
import { useUIStore } from "@/stores/ui-store";
import { terminateTrainingWorker } from "@/workers/training.api";
import { DatasetSelector } from "./DatasetSelector";
import { HyperparamPanel } from "./HyperparamPanel";
import { LossCurveChart } from "./LossCurveChart";
import { NetworkArchitect } from "./NetworkArchitect";
import { NetworkCanvas } from "./NetworkCanvas";
import { TrainingControls } from "./TrainingControls";
import { TutorialOverlay } from "./TutorialOverlay";

const ConfusionMatrix = dynamic(
	() =>
		import("./ConfusionMatrix").then((m) => ({ default: m.ConfusionMatrix })),
	{ ssr: false },
);

const ActivationViewer = dynamic(
	() =>
		import("./ActivationViewer").then((m) => ({ default: m.ActivationViewer })),
	{ ssr: false },
);

export function PlaygroundShell() {
	const darkMode = useUIStore((s) => s.darkMode);
	const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
	const architectPanelOpen = useUIStore((s) => s.architectPanelOpen);
	const toggleArchitectPanel = useUIStore((s) => s.toggleArchitectPanel);
	const metricsPanelOpen = useUIStore((s) => s.metricsPanelOpen);
	const toggleMetricsPanel = useUIStore((s) => s.toggleMetricsPanel);
	const rightPanelTab = useUIStore((s) => s.rightPanelTab);
	const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);
	const setActiveTutorial = useUIStore((s) => s.setActiveTutorial);

	const layers = useArchitectureStore((s) => s.layers);
	const inputShape = useArchitectureStore((s) => s.inputShape);
	const datasetId = useTrainingStore((s) => s.datasetId);
	const trainingConfig = useTrainingStore((s) => s.trainingConfig);

	const [shareToast, setShareToast] = useState(false);
	const [tutorialMenuOpen, setTutorialMenuOpen] = useState(false);

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

	// Hydrate state from URL hash on mount
	useEffect(() => {
		const encoded = getHashParam("config");
		if (!encoded) return;
		const decoded = decodeState(encoded);
		if (!decoded) return;
		useArchitectureStore.getState().setLayers(decoded.layers);
		useArchitectureStore.getState().setInputShape(decoded.inputShape);
		useTrainingStore.getState().setDatasetId(decoded.datasetId);
		useTrainingStore.getState().setTrainingConfig(decoded.trainingConfig);
	}, []);

	// Hydrate dark mode preference from localStorage on mount
	useEffect(() => {
		const saved = localStorage.getItem("darkMode");
		if (saved === null) return;
		const shouldBeDark = saved === "true";
		if (useUIStore.getState().darkMode !== shouldBeDark) {
			useUIStore.getState().toggleDarkMode();
		}
	}, []);

	function handleShare() {
		setHashParam(
			"config",
			encodeState({ layers, inputShape, datasetId, trainingConfig }),
		);
		void navigator.clipboard.writeText(window.location.href);
		setShareToast(true);
		setTimeout(() => setShareToast(false), 2000);
	}

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
					{/* Tutorial button */}
					<div className="relative">
						<button
							type="button"
							onClick={() => setTutorialMenuOpen((v) => !v)}
							className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
							title="Guided tutorials"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M2 3h12v9H2zM5 3V1M11 3V1M2 7h12" />
							</svg>
						</button>
						{tutorialMenuOpen && (
							<div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
								<div className="px-3 py-2 border-b border-slate-800">
									<p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
										Guided Tutorials
									</p>
								</div>
								{TUTORIALS.map((t) => (
									<button
										key={t.id}
										type="button"
										onClick={() => {
											setActiveTutorial(t.id);
											setTutorialMenuOpen(false);
										}}
										className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors"
									>
										<p className="text-xs font-medium text-slate-200">
											{t.title}
										</p>
										<p className="text-[10px] text-slate-500 mt-0.5">
											{t.description}
										</p>
									</button>
								))}
							</div>
						)}
					</div>

					{/* Share button */}
					<div className="relative">
						<button
							type="button"
							onClick={handleShare}
							className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
							title="Copy share link"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M10 3a2 2 0 1 0 0-2M6 8a2 2 0 1 0 0-2M10 13a2 2 0 1 0 0-2M3.5 7l9-4M3.5 9l9 4" />
							</svg>
						</button>
						{shareToast && (
							<div className="absolute right-0 top-full mt-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300 whitespace-nowrap z-50">
								Link copied!
							</div>
						)}
					</div>

					{/* Metrics panel toggle */}
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

					{/* Dark mode toggle */}
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
				{/* Mobile backdrop */}
				{architectPanelOpen && (
					<div
						className="fixed inset-0 bg-black/50 z-20 lg:hidden"
						onClick={toggleArchitectPanel}
					/>
				)}

				{/* Left panel */}
				<aside
					className={[
						"flex flex-col border-r border-slate-800 overflow-y-auto flex-shrink-0",
						"transition-all duration-200 ease-in-out",
						"max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:h-full max-lg:z-30 lg:relative lg:z-auto",
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

			<TutorialOverlay />
		</div>
	);
}
