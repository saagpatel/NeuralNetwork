import type { Tutorial } from "@/types";

export const TUTORIALS: Tutorial[] = [
	{
		id: "what-is-a-neuron",
		title: "What is a Neuron?",
		description: "Understand how a single neuron learns",
		steps: [
			{
				title: "Start with a simple network",
				body: "We've loaded a 2-layer network. Each circle is a neuron — a function that multiplies inputs by weights, sums them, and applies an activation.",
				presetId: "simple-dense",
			},
			{
				title: "Watch weights change",
				body: "Hit Train and watch the heatmap on each connection. Blue = negative weight, red = positive. The network adjusts these to reduce loss.",
			},
			{
				title: "Loss measures error",
				body: "The Loss curve shows how wrong the network is. It should drop as training progresses.",
				switchTab: "loss",
			},
		],
	},
	{
		id: "why-overfitting-happens",
		title: "Why Overfitting Happens",
		description: "See a network memorize training data",
		steps: [
			{
				title: "Enable Overfitting Demo",
				body: "We've limited training to 500 samples and 50 epochs — a classic recipe for overfitting.",
				presetId: "wide-dense",
				enableOverfitting: true,
			},
			{
				title: "Train and watch",
				body: "Train now. Watch the train loss drop toward zero while val loss starts rising — the network memorizes instead of generalizing.",
				switchTab: "loss",
			},
			{
				title: "See misclassifications",
				body: "The confusion matrix shows where the model fails on test data it never saw during training.",
				switchTab: "confusion",
			},
		],
	},
	{
		id: "how-cnns-see-images",
		title: "How CNNs See Images",
		description: "Visualize what each layer detects",
		steps: [
			{
				title: "Load a CNN",
				body: "We've loaded the Simple CNN preset: one convolution, one pooling, and two dense layers.",
				presetId: "simple-cnn",
			},
			{
				title: "Train and inspect",
				body: "After training, switch to Activations. Each row shows what a layer 'sees' for a test image.",
				switchTab: "activations",
			},
			{
				title: "Click a sample",
				body: "Click any thumbnail to inspect that image. The first convolutional layer finds edges; deeper layers find shapes.",
			},
		],
	},
];
