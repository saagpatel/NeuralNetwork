import type { ReactNode } from "react";

interface TooltipProps {
	content: string;
	children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
	return (
		<span className="relative group inline-flex">
			{children}
			<span
				role="tooltip"
				className={[
					"absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
					"w-max max-w-xs px-2 py-1 rounded",
					"bg-slate-700 text-slate-100 text-xs leading-snug",
					"opacity-0 group-hover:opacity-100 pointer-events-none",
					"transition-opacity duration-150",
					"whitespace-pre-wrap",
				].join(" ")}
			>
				{content}
				{/* Arrow */}
				<span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
			</span>
		</span>
	);
}
