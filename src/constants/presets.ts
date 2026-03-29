import type { NetworkPreset } from "@/types";

export const PRESETS: NetworkPreset[] = [
	{
		id: "simple-dense",
		name: "Simple Dense",
		description: "A minimal 2-layer network. Good starting point for MNIST.",
		layers: [
			{ type: "flatten" },
			{ type: "dense", units: 128, activation: "relu" },
			{ type: "dense", units: 10, activation: "softmax" },
		],
		recommendedDataset: "mnist",
	},
	{
		id: "deep-dense",
		name: "Deep Dense",
		description: "4-layer network. More capacity for complex patterns.",
		layers: [
			{ type: "flatten" },
			{ type: "dense", units: 256, activation: "relu" },
			{ type: "dense", units: 128, activation: "relu" },
			{ type: "dense", units: 64, activation: "relu" },
			{ type: "dense", units: 10, activation: "softmax" },
		],
		recommendedDataset: "mnist",
	},
	{
		id: "wide-dense",
		name: "Wide Dense",
		description:
			"Wide 3-layer network. Explores width vs depth trade-off. Prone to overfitting.",
		layers: [
			{ type: "flatten" },
			{ type: "dense", units: 512, activation: "relu" },
			{ type: "dense", units: 256, activation: "relu" },
			{ type: "dense", units: 10, activation: "softmax" },
		],
		recommendedDataset: "mnist",
	},
];

export const PRESET_MAP: Record<string, NetworkPreset> = Object.fromEntries(
	PRESETS.map((p) => [p.id, p]),
);
