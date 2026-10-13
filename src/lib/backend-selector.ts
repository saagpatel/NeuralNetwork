import "@tensorflow/tfjs-backend-webgpu";
import * as tf from "@tensorflow/tfjs";

/**
 * Initializes TF.js with the best available backend.
 * Falls back: WebGPU → WebGL → TF.js default (CPU).
 * Safe to call from both main thread and Web Worker.
 *
 * @returns The name of the active backend.
 */
export async function initTFBackend(): Promise<string> {
	const backends: string[] = ["webgpu", "webgl"];

	for (const backend of backends) {
		try {
			await tf.setBackend(backend);
			await tf.ready();
			const active = tf.getBackend();
			console.log(`TF.js backend: ${active}`);
			return active;
		} catch (error) {
			console.warn(`TF.js ${backend} backend unavailable`, error);
		}
	}

	// Should never reach here — TF.js always has a CPU fallback
	await tf.ready();
	const active = tf.getBackend();
	console.log(`TF.js backend: ${active}`);
	return active;
}
