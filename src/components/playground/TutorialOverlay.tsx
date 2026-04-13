"use client";

import { useEffect } from "react";
import { PRESET_MAP } from "@/constants/presets";
import { TUTORIALS } from "@/constants/tutorials";
import { useArchitectureStore } from "@/stores/architecture-store";
import { useUIStore } from "@/stores/ui-store";

export function TutorialOverlay() {
	const activeTutorialId = useUIStore((s) => s.activeTutorialId);
	const tutorialStep = useUIStore((s) => s.tutorialStep);
	const setTutorialStep = useUIStore((s) => s.setTutorialStep);
	const setActiveTutorial = useUIStore((s) => s.setActiveTutorial);
	const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);
	const overfittingMode = useUIStore((s) => s.overfittingMode);
	const toggleOverfittingMode = useUIStore((s) => s.toggleOverfittingMode);
	const setLayers = useArchitectureStore((s) => s.setLayers);
	const setInputShape = useArchitectureStore((s) => s.setInputShape);

	const tutorial = TUTORIALS.find((t) => t.id === activeTutorialId);

	useEffect(() => {
		if (!tutorial) return;
		const step = tutorial.steps[tutorialStep];
		if (!step) return;

		if (step.presetId) {
			const preset = PRESET_MAP[step.presetId];
			if (preset) {
				setLayers(preset.layers);
				if (preset.inputShape) {
					setInputShape(preset.inputShape);
				}
			}
		}

		if (step.switchTab) {
			setRightPanelTab(step.switchTab);
		}

		if (step.enableOverfitting && !overfittingMode) {
			toggleOverfittingMode();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeTutorialId, tutorialStep]);

	if (!tutorial) return null;

	const step = tutorial.steps[tutorialStep];
	if (!step) return null;

	const isLast = tutorialStep === tutorial.steps.length - 1;

	return (
		<div className="fixed bottom-4 right-4 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50">
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
				<span className="text-xs font-medium text-slate-300">
					{tutorial.title}
				</span>
				<div className="flex items-center gap-3">
					<span className="text-[10px] text-slate-400">
						{tutorialStep + 1}/{tutorial.steps.length}
					</span>
					<button
						type="button"
						onClick={() => setActiveTutorial(null)}
						className="text-slate-400 hover:text-slate-200 transition-colors"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						>
							<path d="M1 1l12 12M13 1L1 13" />
						</svg>
					</button>
				</div>
			</div>
			<div className="px-4 py-3">
				<p className="text-xs font-semibold text-slate-200 mb-1">
					{step.title}
				</p>
				<p className="text-xs text-slate-400 leading-relaxed">{step.body}</p>
			</div>
			<div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
				<button
					type="button"
					onClick={() => setTutorialStep(tutorialStep - 1)}
					disabled={tutorialStep === 0}
					className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				>
					Back
				</button>
				<div className="flex gap-1">
					{tutorial.steps.map((_, i) => (
						<div
							key={i}
							className={`w-1.5 h-1.5 rounded-full transition-colors ${
								i === tutorialStep ? "bg-blue-500" : "bg-slate-700"
							}`}
						/>
					))}
				</div>
				<button
					type="button"
					onClick={() => {
						if (isLast) setActiveTutorial(null);
						else setTutorialStep(tutorialStep + 1);
					}}
					className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
				>
					{isLast ? "Finish" : "Next"}
				</button>
			</div>
		</div>
	);
}
