"use client";

import { useEffect, useRef, useState } from "react";
import { hydrateSharedConfigFromHash } from "@/lib/url-state";

export function SharedConfigHydrator() {
	const [ignored, setIgnored] = useState(false);
	const hydrationAttempted = useRef(false);

	useEffect(() => {
		if (hydrationAttempted.current) return;
		hydrationAttempted.current = true;
		if (hydrateSharedConfigFromHash() === "ignored") {
			setIgnored(true);
		}
	}, []);

	if (!ignored) return null;

	return (
		<div
			role="status"
			className="flex-shrink-0 px-4 py-2 bg-amber-950 border-b border-amber-800 text-amber-100 text-xs"
		>
			Shared configuration ignored
		</div>
	);
}
