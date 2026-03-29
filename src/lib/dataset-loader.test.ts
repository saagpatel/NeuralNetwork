import { describe, expect, it } from "vitest";
import {
	normalizeImages,
	parseIdxImages,
	parseIdxLabels,
} from "./dataset-loader";

describe("parseIdxImages", () => {
	function makeImageBuffer(
		count: number,
		rows: number,
		cols: number,
	): ArrayBuffer {
		// IDX format: 4 bytes magic, 4 bytes count, 4 bytes rows, 4 bytes cols, then pixels
		const header = new ArrayBuffer(16);
		const view = new DataView(header);
		view.setInt32(0, 0x00000803, false); // magic (big-endian)
		view.setInt32(4, count, false);
		view.setInt32(8, rows, false);
		view.setInt32(12, cols, false);

		const pixels = new ArrayBuffer(count * rows * cols);
		const buf = new ArrayBuffer(16 + count * rows * cols);
		new Uint8Array(buf).set(new Uint8Array(header), 0);
		new Uint8Array(buf).set(new Uint8Array(pixels), 16);
		return buf;
	}

	it("parses a valid IDX image buffer with correct byte count", () => {
		const buf = makeImageBuffer(100, 28, 28);
		const result = parseIdxImages(buf);
		expect(result.length).toBe(100 * 28 * 28);
	});

	it("parses small buffer correctly", () => {
		const buf = makeImageBuffer(2, 4, 4);
		const result = parseIdxImages(buf);
		expect(result.length).toBe(2 * 4 * 4);
	});

	it("throws on wrong magic number", () => {
		const buf = new ArrayBuffer(20);
		const view = new DataView(buf);
		view.setInt32(0, 0x00000801, false); // label magic, not image
		expect(() => parseIdxImages(buf)).toThrow("Invalid IDX image magic");
	});
});

describe("parseIdxLabels", () => {
	function makeLabelBuffer(count: number): ArrayBuffer {
		const buf = new ArrayBuffer(8 + count);
		const view = new DataView(buf);
		view.setInt32(0, 0x00000801, false); // label magic (big-endian)
		view.setInt32(4, count, false);
		return buf;
	}

	it("parses a valid IDX label buffer with correct count", () => {
		const buf = makeLabelBuffer(60000);
		const result = parseIdxLabels(buf);
		expect(result.length).toBe(60000);
	});

	it("throws on wrong magic number", () => {
		const buf = new ArrayBuffer(20);
		const view = new DataView(buf);
		view.setInt32(0, 0x00000803, false); // image magic, not label
		expect(() => parseIdxLabels(buf)).toThrow("Invalid IDX label magic");
	});
});

describe("normalizeImages", () => {
	it("normalizes all 255 values to 1.0", () => {
		const raw = new Uint8Array([255, 255, 255]);
		const result = normalizeImages(raw);
		expect(result[0]).toBeCloseTo(1.0);
		expect(result[1]).toBeCloseTo(1.0);
		expect(result[2]).toBeCloseTo(1.0);
	});

	it("normalizes 0 to 0.0", () => {
		const raw = new Uint8Array([0, 0, 0]);
		const result = normalizeImages(raw);
		expect(result[0]).toBe(0);
	});

	it("normalizes midpoint 127 to ~0.498", () => {
		const raw = new Uint8Array([127]);
		const result = normalizeImages(raw);
		expect(result[0]).toBeCloseTo(127 / 255, 3);
	});

	it("returns Float32Array of same length as input", () => {
		const raw = new Uint8Array(784);
		const result = normalizeImages(raw);
		expect(result).toBeInstanceOf(Float32Array);
		expect(result.length).toBe(784);
	});

	it("all values are in [0, 1] range", () => {
		const raw = new Uint8Array(256);
		for (let i = 0; i < 256; i++) raw[i] = i;
		const result = normalizeImages(raw);
		for (const v of result) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		}
	});
});
