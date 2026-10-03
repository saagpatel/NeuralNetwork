import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tf from "@tensorflow/tfjs";
import { initTFBackend } from "./backend-selector";

vi.mock("@tensorflow/tfjs-backend-webgpu", () => ({}));
vi.mock("@tensorflow/tfjs", () => ({
	setBackend: vi.fn(),
	ready: vi.fn(),
	getBackend: vi.fn(),
}));

describe("initTFBackend", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.mocked(tf.setBackend).mockResolvedValue(true);
		vi.mocked(tf.ready).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prefers WebGPU when initialization succeeds", async () => {
		vi.mocked(tf.getBackend).mockReturnValue("webgpu");

		await expect(initTFBackend()).resolves.toBe("webgpu");
		expect(tf.setBackend).toHaveBeenCalledExactlyOnceWith("webgpu");
		expect(tf.ready).toHaveBeenCalledTimes(1);
	});

	it("falls back to WebGL when WebGPU selection fails", async () => {
		vi.mocked(tf.setBackend).mockRejectedValueOnce(new Error("Unavailable"));
		vi.mocked(tf.getBackend).mockReturnValue("webgl");

		await expect(initTFBackend()).resolves.toBe("webgl");
		expect(vi.mocked(tf.setBackend).mock.calls).toEqual([["webgpu"], ["webgl"]]);
	});

	it("falls back to WebGL when WebGPU readiness fails", async () => {
		vi.mocked(tf.ready).mockRejectedValueOnce(new Error("Initialization failed"));
		vi.mocked(tf.getBackend).mockReturnValue("webgl");

		await expect(initTFBackend()).resolves.toBe("webgl");
		expect(vi.mocked(tf.setBackend).mock.calls).toEqual([["webgpu"], ["webgl"]]);
		expect(tf.ready).toHaveBeenCalledTimes(2);
	});

	it("uses the TF.js default after both accelerated backends fail without trying wasm", async () => {
		vi.mocked(tf.setBackend).mockRejectedValue(new Error("Unavailable"));
		vi.mocked(tf.getBackend).mockReturnValue("cpu");

		await expect(initTFBackend()).resolves.toBe("cpu");
		expect(vi.mocked(tf.setBackend).mock.calls).toEqual([["webgpu"], ["webgl"]]);
		expect(tf.ready).toHaveBeenCalledTimes(1);
	});
});
