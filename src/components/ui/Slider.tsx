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
	const displayValue = format ? format(value) : String(value);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between items-baseline">
				<span className="text-xs text-slate-400">{label}</span>
				<span className="text-xs font-mono text-slate-200">{displayValue}</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
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
