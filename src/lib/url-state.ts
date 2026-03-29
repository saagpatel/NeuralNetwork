import LZString from "lz-string";
import type { DatasetId, LayerConfig, TrainingConfig } from "@/types";

export interface ShareableState {
	layers: LayerConfig[];
	inputShape: number[];
	datasetId: DatasetId;
	trainingConfig: TrainingConfig;
}

export function encodeState(state: ShareableState): string {
	return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodeState(encoded: string): ShareableState | null {
	try {
		const json = LZString.decompressFromEncodedURIComponent(encoded);
		if (!json) return null;
		return JSON.parse(json) as ShareableState;
	} catch {
		return null;
	}
}

export function getHashParam(key: string): string | null {
	if (typeof window === "undefined") return null;
	const hash = window.location.hash.slice(1);
	const params = new URLSearchParams(hash);
	return params.get(key);
}

export function setHashParam(key: string, value: string): void {
	const hash = window.location.hash.slice(1);
	const params = new URLSearchParams(hash);
	params.set(key, value);
	window.location.hash = params.toString();
}
