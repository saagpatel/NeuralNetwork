"use client";

import { useEffect, useState } from "react";
import { initTFBackend } from "@/lib/backend-selector";

export default function HomePage() {
	const [backend, setBackend] = useState<string | null>(null);

	useEffect(() => {
		initTFBackend()
			.then(setBackend)
			.catch((err: unknown) => {
				console.error("TF.js backend init failed:", err);
			});
	}, []);

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8 font-mono">
			<h1 className="text-2xl font-bold">Neural Network Playground</h1>
			<p className="mt-2 text-gray-500">Phase 0 — Foundation</p>
			{backend ? (
				<p className="mt-4 rounded bg-green-100 px-3 py-1 text-sm text-green-800">
					TF.js backend: {backend}
				</p>
			) : (
				<p className="mt-4 text-sm text-gray-400">Initializing TF.js...</p>
			)}
		</main>
	);
}
