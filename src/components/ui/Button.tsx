import type { ReactNode } from "react";

interface ButtonProps {
	variant: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	disabled?: boolean;
	onClick(): void;
	children: ReactNode;
	title?: string;
	className?: string;
}

const VARIANT_CLASSES: Record<ButtonProps["variant"], string> = {
	primary: "bg-blue-600 hover:bg-blue-500 text-white border-transparent",
	secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600",
	ghost: "bg-transparent hover:bg-slate-800 text-slate-300 border-transparent",
	danger: "bg-red-700 hover:bg-red-600 text-white border-transparent",
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
	sm: "px-2 py-1 text-xs",
	md: "px-3 py-1.5 text-sm",
	lg: "px-4 py-2 text-base",
};

export function Button({
	variant,
	size = "md",
	disabled = false,
	onClick,
	children,
	title,
	className = "",
}: ButtonProps) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			title={title}
			className={[
				"inline-flex items-center justify-center gap-1.5 rounded border font-medium",
				"transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-950",
				VARIANT_CLASSES[variant],
				SIZE_CLASSES[size],
				disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
				className,
			]
				.filter(Boolean)
				.join(" ")}
		>
			{children}
		</button>
	);
}
