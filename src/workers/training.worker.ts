/// <reference lib="webworker" />
import "@tensorflow/tfjs-backend-webgpu";
import * as tf from "@tensorflow/tfjs";
import * as Comlink from "comlink";
import { buildActivationModel } from "@/lib/activation-extractor";
import { initTFBackend } from "@/lib/backend-selector";
import { loadDataset } from "@/lib/dataset-loader";
import { compileModel } from "@/lib/model-compiler";
import { extractWeights } from "@/lib/weight-extractor";
import type {
	DatasetId,
	LayerActivation,
	NetworkConfig,
	TrainingConfig,
	TrainingUpdate,
} from "@/types";

interface TrainingWorkerAPI {
	start(
		networkConfig: NetworkConfig,
		trainingConfig: TrainingConfig,
		datasetId: DatasetId,
		snapshotEveryNBatches: number,
		onUpdate: (update: TrainingUpdate) => void,
		onComplete: (finalMetrics: FinalMetrics) => void,
		onError: (message: string) => void,
		onLoadProgress: (progress: number) => void,
	): Promise<void>;
	pause(): void;
	resume(): void;
	stop(): void;
	getActivations(sampleIndex: number): Promise<LayerActivation[]>;
	getActivationsBatch(sampleIndices: number[]): Promise<LayerActivation[][]>;
	getTestSamples(n: number): Promise<{ xs: number[][][]; ys: number[] }>;
}

interface FinalMetrics {
	trainLoss: number;
	trainAccuracy: number;
	testLoss: number;
	testAccuracy: number;
}

// Mutable training state — held in an object so linter won't convert to const
const state = {
	isPaused: false,
	isStopped: false,
	testImages: null as Float32Array | null,
	testLabels: null as Uint8Array | null,
	inputShape: null as number[] | null,
	networkConfig: null as NetworkConfig | null,
	trainingConfig: null as TrainingConfig | null,
	weightSnapshots: null as ReturnType<typeof extractWeights> | null,
};

function disposeState() {
	state.testImages = null;
	state.testLabels = null;
	state.inputShape = null;
	state.networkConfig = null;
	state.trainingConfig = null;
	state.weightSnapshots = null;
}

const worker: TrainingWorkerAPI = {
	async start(
		networkConfig,
		trainingConfig,
		datasetId,
		snapshotEveryNBatches,
		onUpdate,
		onComplete,
		onError,
		onLoadProgress,
	) {
		disposeState();
		state.isPaused = false;
		state.isStopped = false;
		const tensors: tf.Tensor[] = [];
		let model: tf.LayersModel | null = null;

		try {
			await initTFBackend();

			// Load dataset — report download progress via onLoadProgress
			const dataset = await loadDataset(datasetId, (_stage, progress) => {
				onLoadProgress(progress);
			});

			const { testImages, testLabels, meta } = dataset;
			let { trainImages, trainLabels } = dataset;
			const { inputShape, numClasses } = {
				...meta,
				inputShape: networkConfig.inputShape,
			};
			const pixelsPerImage = inputShape.reduce((a, b) => a * b, 1);

			// Overfitting demo: slice training set if maxTrainSamples is set
			let trainSize = meta.trainSize;
			if (
				trainingConfig.maxTrainSamples !== undefined &&
				trainingConfig.maxTrainSamples < trainSize
			) {
				trainSize = trainingConfig.maxTrainSamples;
				trainImages = trainImages.slice(0, trainSize * pixelsPerImage);
				trainLabels = trainLabels.slice(0, trainSize);
			}

			// Convert to tensors and one-hot encode labels
			const xs = tf.tensor2d(trainImages, [trainSize, pixelsPerImage]);
			tensors.push(xs);
			const xsReshaped = xs.reshape([trainSize, ...inputShape]);
			tensors.push(xsReshaped);
			xs.dispose();

			const ysFlat = tf.tensor1d(
				Array.from(trainLabels).map((v) => v),
				"int32",
			);
			tensors.push(ysFlat);
			const ys = tf.oneHot(ysFlat, numClasses);
			tensors.push(ys);
			ysFlat.dispose();

			// Build temporary test tensors for confusion-matrix evaluation.
			const testCount = testImages.length / pixelsPerImage;
			const xsTestFlat = tf.tensor2d(testImages, [testCount, pixelsPerImage]);
			tensors.push(xsTestFlat);
			const xsTestRaw = xsTestFlat.reshape([testCount, ...inputShape]);
			tensors.push(xsTestRaw);
			xsTestFlat.dispose();
			const ysTestFlatCached = tf.tensor1d(
				Array.from(testLabels).map((v) => v),
				"int32",
			);
			tensors.push(ysTestFlatCached);
			const ysTestCached = tf.oneHot(ysTestFlatCached, numClasses);
			tensors.push(ysTestCached);
			ysTestFlatCached.dispose();
			model = compileModel(networkConfig, trainingConfig);

			const batchesPerEpoch = Math.ceil(
				(trainSize * (1 - trainingConfig.validationSplit)) /
					trainingConfig.batchSize,
			);

			const startTime = Date.now();
			let finalMetrics: FinalMetrics = {
				trainLoss: 0,
				trainAccuracy: 0,
				testLoss: 0,
				testAccuracy: 0,
			};

			// Train epoch-by-epoch so we can check pause/stop between epochs
			for (let epoch = 0; epoch < trainingConfig.epochs; epoch++) {
				if (state.isStopped) break;

				// Wait while paused
				while (state.isPaused) {
					await new Promise((r) => setTimeout(r, 100));
					if (state.isStopped) break;
				}
				if (state.isStopped) break;

				let batchCount = 0;

				await model.fit(xsReshaped, ys, {
					epochs: 1,
					batchSize: trainingConfig.batchSize,
					validationSplit: trainingConfig.validationSplit,
					shuffle: true,
					callbacks: {
						onBatchEnd: async (batch, logs) => {
							batchCount++;
							if (batchCount % snapshotEveryNBatches === 0) {
								const snapshots = extractWeights(model!);
								onUpdate({
									epoch,
									batch,
									totalBatches: batchesPerEpoch,
									trainLoss: logs?.["loss"] ?? 0,
									trainAccuracy: logs?.["acc"] ?? logs?.["accuracy"] ?? 0,
									valLoss: null,
									valAccuracy: null,
									weightSnapshots: snapshots,
									activationSnapshots: null,
									elapsedMs: Date.now() - startTime,
								});
							}
						},
						onEpochEnd: async (_epoch, logs) => {
							const snapshots = extractWeights(model!);

							// Confusion matrix on test subset at epoch end
							const subsetSize = Math.min(1000, testCount);
							let confusionMatrix: number[][] | undefined;
							if (subsetSize > 0) {
								const numCls = numClasses;
								const testSubX = xsTestRaw.slice([0], [subsetSize]);
								const testSubY = ysTestCached.slice([0], [subsetSize]);
								const preds = model!.predict(testSubX) as tf.Tensor2D;
								const predIndices = tf.tidy(() =>
									Array.from(preds.argMax(-1).dataSync()),
								);
								const trueIndices = tf.tidy(() =>
									Array.from(testSubY.argMax(-1).dataSync()),
								);
								testSubX.dispose();
								testSubY.dispose();
								preds.dispose();

								const matrix: number[][] = Array.from({ length: numCls }, () =>
									new Array<number>(numCls).fill(0),
								);
								for (let idx = 0; idx < subsetSize; idx++) {
									const t = trueIndices[idx];
									const p = predIndices[idx];
									if (typeof t === "number" && typeof p === "number") {
										const row = matrix[t] as number[];
										row[p] = (row[p] ?? 0) + 1;
									}
								}
								confusionMatrix = matrix;
							}

							const update: TrainingUpdate = {
								epoch,
								batch: batchesPerEpoch,
								totalBatches: batchesPerEpoch,
								trainLoss: logs?.["loss"] ?? 0,
								trainAccuracy: logs?.["acc"] ?? logs?.["accuracy"] ?? 0,
								valLoss: logs?.["val_loss"] ?? null,
								valAccuracy:
									logs?.["val_acc"] ?? logs?.["val_accuracy"] ?? null,
								weightSnapshots: snapshots,
								activationSnapshots: null,
								confusionMatrix,
								elapsedMs: Date.now() - startTime,
							};
							onUpdate(update);

							finalMetrics = {
								trainLoss: update.trainLoss,
								trainAccuracy: update.trainAccuracy,
								testLoss: 0,
								testAccuracy: 0,
							};
						},
					},
				});
			}

			// Preserve plain arrays for post-training inspection; release TF tensors below.
			state.testImages = testImages;
			state.testLabels = testLabels;
			state.inputShape = [...inputShape];
			state.networkConfig = networkConfig;
			state.trainingConfig = trainingConfig;
			state.weightSnapshots = extractWeights(model);

			// Run final evaluation on test set
			if (!state.isStopped) {
				const testCount2 = testImages.length / pixelsPerImage;
				const xsTestFlat = tf.tensor2d(testImages, [
					testCount2,
					pixelsPerImage,
				]);
				tensors.push(xsTestFlat);
				const xsTest = xsTestFlat.reshape([testCount2, ...inputShape]);
				tensors.push(xsTest);
				xsTestFlat.dispose();
				const ysTestFlat = tf.tensor1d(
					Array.from(testLabels).map((v) => v),
					"int32",
				);
				tensors.push(ysTestFlat);
				const ysTest = tf.oneHot(ysTestFlat, numClasses);
				tensors.push(ysTest);
				ysTestFlat.dispose();

				const evalResult = model.evaluate(xsTest, ysTest) as tf.Scalar[];
				tensors.push(...evalResult);
				const evalLoss = evalResult[0].dataSync()[0];
				const evalAcc = evalResult[1].dataSync()[0];

				finalMetrics.testLoss = evalLoss ?? 0;
				finalMetrics.testAccuracy = evalAcc ?? 0;

				xsTest.dispose();
				ysTest.dispose();
				evalResult.forEach((t) => t.dispose());
			}

			// Tensor data for post-training inspection is kept as plain arrays.
			onComplete(finalMetrics);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			onError(message);
		} finally {
			for (const tensor of tensors) tensor.dispose();
			model?.dispose();
		}
	},

	pause() {
		state.isPaused = true;
	},

	resume() {
		state.isPaused = false;
	},

	stop() {
		state.isStopped = true;
		state.isPaused = false;
	},

	async getActivations(sampleIndex: number): Promise<LayerActivation[]> {
		return (await this.getActivationsBatch([sampleIndex]))[0] ?? [];
	},

	async getActivationsBatch(
		sampleIndices: number[],
	): Promise<LayerActivation[][]> {
		if (
			!state.testImages ||
			!state.inputShape ||
			!state.networkConfig ||
			!state.trainingConfig ||
			!state.weightSnapshots ||
			sampleIndices.length === 0
		)
			return [];

		const model = compileModel(state.networkConfig, state.trainingConfig);
		let activationModel: tf.LayersModel | null = null;
		let samples: tf.Tensor | null = null;
		let outputList: tf.Tensor[] = [];
		try {
			const snapshotsByLayer = new Map(
				state.weightSnapshots.map((item) => [item.layerIndex, item]),
			);
			for (const [layerIndex, layer] of model.layers.entries()) {
				const snapshot = snapshotsByLayer.get(layerIndex);
				if (!snapshot) continue;
				const kernel = tf.tensor(snapshot.weights, snapshot.shape);
				const bias = tf.tensor1d(snapshot.biases);
				try {
					layer.setWeights([kernel, bias]);
				} finally {
					kernel.dispose();
					bias.dispose();
				}
			}
			activationModel = buildActivationModel(model);
			const pixelsPerImage = state.inputShape.reduce((a, b) => a * b, 1);
			const data = new Float32Array(sampleIndices.length * pixelsPerImage);
			for (const [batchIndex, sampleIndex] of sampleIndices.entries()) {
				const start = sampleIndex * pixelsPerImage;
				data.set(
					state.testImages.subarray(start, start + pixelsPerImage),
					batchIndex * pixelsPerImage,
				);
			}
			samples = tf.tensor(data, [sampleIndices.length, ...state.inputShape]);
			const outputs = activationModel.predict(samples);
			outputList = Array.isArray(outputs) ? outputs : [outputs];
			const outputData = outputList.map(
				(tensor) => tensor.dataSync() as Float32Array,
			);
			return sampleIndices.map((_, sampleIndex) =>
				outputList.map((tensor, layerIndex) => {
					const layer = model.layers[layerIndex];
					const sampleSize = tensor.size / sampleIndices.length;
					return {
						layerIndex,
						layerName: layer?.name ?? `layer_${layerIndex}`,
						shape: tensor.shape.slice(1) as number[],
						data: (outputData[layerIndex] ?? new Float32Array()).slice(
							sampleIndex * sampleSize,
							(sampleIndex + 1) * sampleSize,
						),
					};
				}),
			);
		} catch (error) {
			console.warn("Activations unavailable for this model", error);
			return [];
		} finally {
			samples?.dispose();
			outputList.forEach((tensor) => tensor.dispose());
			activationModel?.dispose();
			model.dispose();
		}
	},

	async getTestSamples(n: number): Promise<{ xs: number[][][]; ys: number[] }> {
		if (!state.testImages || !state.testLabels || !state.inputShape)
			return { xs: [], ys: [] };
		const pixelsPerImage = state.inputShape.reduce((a, b) => a * b, 1);
		const count = Math.min(n, state.testLabels.length);
		const samples = tf.tensor(
			state.testImages.subarray(0, count * pixelsPerImage),
			[count, ...state.inputShape],
		);
		const xs = samples.arraySync() as number[][][];
		samples.dispose();
		return { xs, ys: Array.from(state.testLabels.subarray(0, count)) };
	},
};

Comlink.expose(worker);
