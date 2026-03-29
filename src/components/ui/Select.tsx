interface SelectOption<T extends string> {
	value: T;
	label: string;
	disabled?: boolean;
}

interface SelectProps<T extends string> {
	label?: string;
	value: T;
	options: SelectOption<T>[];
	onChange(value: T): void;
	disabled?: boolean;
}

export function Select<T extends string>({
	label,
	value,
	options,
	onChange,
	disabled = false,
}: SelectProps<T>) {
	return (
		<div className="flex flex-col gap-1">
			{label && <span className="text-xs text-slate-400">{label}</span>}
			<select
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value as T)}
				className={[
					"w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700",
					"text-xs text-slate-200 focus:outline-none focus:border-blue-500",
					"transition-colors",
					disabled
						? "opacity-40 cursor-not-allowed"
						: "cursor-pointer hover:border-slate-500",
				]
					.filter(Boolean)
					.join(" ")}
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value} disabled={opt.disabled}>
						{opt.label}
						{opt.disabled ? " (Phase 2)" : ""}
					</option>
				))}
			</select>
		</div>
	);
}
