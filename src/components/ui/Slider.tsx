import { useId } from "react";

interface SliderProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange(value: number): void;
	format?(value: number): string;
	disabled?: boolean;
}

export function Slider({
	label,
	value,
	min,
	max,
	step,
	onChange,
	format,
	disabled = false,
}: SliderProps) {
	const id = useId();
	const displayValue = format ? format(value) : String(value);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between items-baseline">
				<label htmlFor={id} className="text-xs text-slate-400">
					{label}
				</label>
				<span className="text-xs font-mono text-slate-200">{displayValue}</span>
			</div>
			<input
				id={id}
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
				aria-label={label}
				aria-valuetext={displayValue}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				className={[
					"w-full h-1.5 rounded-full appearance-none cursor-pointer",
					"bg-slate-700 accent-blue-500",
					disabled ? "opacity-40 cursor-not-allowed" : "",
				]
					.filter(Boolean)
					.join(" ")}
			/>
		</div>
	);
}
