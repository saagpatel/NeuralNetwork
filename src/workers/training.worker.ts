/// <reference lib="webworker" />
import "@tensorflow/tfjs-backend-webgpu";
import * as tf from "@tensorflow/tfjs";
import * as Comlink from "comlink";
import { initTFBackend } from "@/lib/backend-selector";
import { loadDataset } from "@/lib/dataset-loader";
import { compileModel } from "@/lib/model-compiler";
import { extractWeights } from "@/lib/weight-extractor";
import type {
	DatasetId,
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
}

interface FinalMetrics {
	trainLoss: number;
	trainAccuracy: number;
	valLoss: number;
	valAccuracy: number;
}

let isPaused = false;
let isStopped = false;

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
		isPaused = false;
		isStopped = false;

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
				if (isStopped) break;

				// Wait while paused
				while (isPaused) {
					await new Promise((r) => setTimeout(r, 100));
					if (isStopped) break;
				}
				if (isStopped) break;

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

			// Run final evaluation on test set
			if (!isStopped) {
				const testCount = testImages.length / pixelsPerImage;
				const xsTest = tf
					.tensor2d(testImages, [testCount, pixelsPerImage])
					.reshape([testCount, ...inputShape]);
				const ysTestFlat = tf.tensor1d(
					Array.from(testLabels).map((v) => v),
					"int32",
				);
				const ysTest = tf.oneHot(ysTestFlat, numClasses);
				ysTestFlat.dispose();

				const evalResult = model.evaluate(xsTest, ysTest) as tf.Scalar[];
				const evalLoss = evalResult[0].dataSync()[0];
				const evalAcc = evalResult[1].dataSync()[0];

				finalMetrics.valLoss = evalLoss;
				finalMetrics.valAccuracy = evalAcc;

				xsTest.dispose();
				ysTest.dispose();
				evalResult.forEach((t) => t.dispose());
			}

			// Cleanup
			xsReshaped.dispose();
			ys.dispose();

			onComplete(finalMetrics);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			onError(message);
		}
	},

	pause() {
		isPaused = true;
	},

	resume() {
		isPaused = false;
	},

	stop() {
		isStopped = true;
		isPaused = false;
	},
};

Comlink.expose(worker);
