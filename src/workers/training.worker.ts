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
	getTestSamples(n: number): Promise<{ xs: number[][][]; ys: number[] }>;
}

interface FinalMetrics {
	trainLoss: number;
	trainAccuracy: number;
	valLoss: number;
	valAccuracy: number;
}

// Mutable training state — held in an object so linter won't convert to const
const state = {
	isPaused: false,
	isStopped: false,
	currentModel: null as tf.LayersModel | null,
	testXsCache: null as tf.Tensor | null,
	testYsCache: null as tf.Tensor | null,
	activationModel: null as tf.LayersModel | null,
};

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
		state.isPaused = false;
		state.isStopped = false;

		try {
			await initTFBackend();

			// Load dataset — report download progress via onLoadProgress
			const dataset = await loadDataset(datasetId, (_stage, progress) => {
				onLoadProgress(progress);
			});

			const { testImages, testLabels, meta } = dataset;
			let { trainImages, trainLabels } = dataset;
			const { inputShape, numClasses } = meta;
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
			const xsReshaped = xs.reshape([trainSize, ...inputShape]);
			xs.dispose();

			const ysFlat = tf.tensor1d(
				Array.from(trainLabels).map((v) => v),
				"int32",
			);
			const ys = tf.oneHot(ysFlat, numClasses);
			ysFlat.dispose();

			// Cache test tensors for confusion matrix and activation extraction
			const testCount = testImages.length / pixelsPerImage;
			const xsTestRaw = tf
				.tensor2d(testImages, [testCount, pixelsPerImage])
				.reshape([testCount, ...inputShape]);
			const ysTestFlatCached = tf.tensor1d(
				Array.from(testLabels).map((v) => v),
				"int32",
			);
			const ysTestCached = tf.oneHot(ysTestFlatCached, numClasses);
			ysTestFlatCached.dispose();
			state.testXsCache = xsTestRaw;
			state.testYsCache = ysTestCached;

			const model = compileModel(networkConfig, trainingConfig);

			const batchesPerEpoch = Math.ceil(
				(trainSize * (1 - trainingConfig.validationSplit)) /
					trainingConfig.batchSize,
			);

			const startTime = Date.now();
			let finalMetrics: FinalMetrics = {
				trainLoss: 0,
				trainAccuracy: 0,
				valLoss: 0,
				valAccuracy: 0,
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
								const snapshots = extractWeights(model);
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
							const snapshots = extractWeights(model);

							// Confusion matrix on test subset at epoch end
							const subsetSize = Math.min(
								1000,
								state.testXsCache?.shape[0] ?? 0,
							);
							let confusionMatrix: number[][] | undefined;
							if (state.testXsCache && state.testYsCache && subsetSize > 0) {
								const numCls = state.testYsCache.shape[1] ?? numClasses;
								const testSubX = state.testXsCache.slice([0], [subsetSize]);
								const testSubY = state.testYsCache.slice([0], [subsetSize]);
								const preds = model.predict(testSubX) as tf.Tensor2D;
								const predIndices = Array.from(preds.argMax(-1).dataSync());
								const trueIndices = Array.from(testSubY.argMax(-1).dataSync());
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
								valLoss: update.valLoss ?? 0,
								valAccuracy: update.valAccuracy ?? 0,
							};
						},
					},
				});
			}

			// Store trained model and build activation model
			state.currentModel = model;
			try {
				state.activationModel = buildActivationModel(model);
			} catch {
				// Sequential models without functional graph won't support activation extraction
				state.activationModel = null;
			}

			// Run final evaluation on test set
			if (!state.isStopped) {
				const testCount2 = testImages.length / pixelsPerImage;
				const xsTest = tf
					.tensor2d(testImages, [testCount2, pixelsPerImage])
					.reshape([testCount2, ...inputShape]);
				const ysTestFlat = tf.tensor1d(
					Array.from(testLabels).map((v) => v),
					"int32",
				);
				const ysTest = tf.oneHot(ysTestFlat, numClasses);
				ysTestFlat.dispose();

				const evalResult = model.evaluate(xsTest, ysTest) as tf.Scalar[];
				const evalLoss = evalResult[0].dataSync()[0];
				const evalAcc = evalResult[1].dataSync()[0];

				finalMetrics.valLoss = evalLoss ?? 0;
				finalMetrics.valAccuracy = evalAcc ?? 0;

				xsTest.dispose();
				ysTest.dispose();
				evalResult.forEach((t) => t.dispose());
			}

			// Cleanup training tensors (keep test cache for post-training use)
			xsReshaped.dispose();
			ys.dispose();

			onComplete(finalMetrics);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			onError(message);
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
		if (!state.activationModel || !state.testXsCache) return [];

		const sample = state.testXsCache.slice([sampleIndex], [1]);
		const outputs = state.activationModel.predict(sample);
		const outputList = Array.isArray(outputs) ? outputs : [outputs];

		const result: LayerActivation[] = outputList.map((tensor, i) => {
			const layer = state.activationModel!.layers[i + 1];
			return {
				layerIndex: i,
				layerName: layer?.name ?? `layer_${i}`,
				shape: tensor.shape.slice(1) as number[],
				data: tensor.dataSync() as Float32Array,
			};
		});

		sample.dispose();
		outputList.forEach((t) => t.dispose());

		return result;
	},

	async getTestSamples(n: number): Promise<{ xs: number[][][]; ys: number[] }> {
		if (!state.testXsCache || !state.testYsCache) return { xs: [], ys: [] };

		const count = Math.min(n, state.testXsCache.shape[0]);
		const xSubset = state.testXsCache.slice([0], [count]);
		const ySubset = state.testYsCache.slice([0], [count]);

		const xData = xSubset.arraySync() as number[][][];
		const yData = Array.from(ySubset.argMax(-1).dataSync()) as number[];

		xSubset.dispose();
		ySubset.dispose();

		return { xs: xData, ys: yData };
	},
};

Comlink.expose(worker);
