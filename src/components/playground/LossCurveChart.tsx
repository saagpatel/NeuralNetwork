"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { useTrainingStore } from "@/stores/training-store";
import { useUIStore } from "@/stores/ui-store";
import type { MetricsHistoryPoint } from "@/types";

const MARGIN = { top: 20, right: 50, bottom: 36, left: 44 };

function renderChart(
	container: HTMLDivElement,
	data: MetricsHistoryPoint[],
	totalEpochs: number,
	overfittingMode: boolean,
) {
	const { width, height } = container.getBoundingClientRect();
	if (width === 0 || height === 0) return;

	const innerW = width - MARGIN.left - MARGIN.right;
	const innerH = height - MARGIN.top - MARGIN.bottom;

	// Create or reuse svg
	const svg = d3
		.select(container)
		.selectAll<SVGSVGElement, unknown>("svg")
		.data([null])
		.join("svg")
		.attr("width", width)
		.attr("height", height)
		.style("display", "block");

	// Create or reuse main group
	const g = svg
		.selectAll<SVGGElement, unknown>("g.main")
		.data([null])
		.join("g")
		.attr("class", "main")
		.attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

	// Scales
	const xScale = d3
		.scaleLinear()
		.domain([
			0,
			Math.max(totalEpochs - 1, data.length > 0 ? data.length - 1 : 1),
		])
		.range([0, innerW]);

	const maxLoss =
		data.length > 0
			? Math.max(
					d3.max(data, (d) => d.trainLoss) ?? 1,
					d3.max(data, (d) => d.valLoss) ?? 1,
				)
			: 1;

	const yLoss = d3
		.scaleLinear()
		.domain([0, maxLoss * 1.1])
		.range([innerH, 0]);

	const yAcc = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

	// Axes
	const xAxis = d3
		.axisBottom(xScale)
		.ticks(Math.min(totalEpochs, 6))
		.tickSize(-innerH);
	const yAxisLeft = d3.axisLeft(yLoss).ticks(5).tickSize(-innerW);
	const yAxisRight = d3.axisRight(yAcc).ticks(5).tickFormat(d3.format(".0%"));

	g.selectAll<SVGGElement, unknown>("g.x-axis")
		.data([null])
		.join("g")
		.attr("class", "x-axis")
		.attr("transform", `translate(0,${innerH})`)
		.call(xAxis)
		.call((a) => a.select(".domain").attr("stroke", "#334155"))
		.call((a) => a.selectAll(".tick line").attr("stroke", "#1e293b"))
		.call((a) =>
			a.selectAll(".tick text").attr("fill", "#64748b").attr("font-size", "10"),
		);

	g.selectAll<SVGGElement, unknown>("g.y-axis-left")
		.data([null])
		.join("g")
		.attr("class", "y-axis-left")
		.call(yAxisLeft)
		.call((a) => a.select(".domain").attr("stroke", "#334155"))
		.call((a) => a.selectAll(".tick line").attr("stroke", "#1e293b"))
		.call((a) =>
			a.selectAll(".tick text").attr("fill", "#64748b").attr("font-size", "10"),
		);

	g.selectAll<SVGGElement, unknown>("g.y-axis-right")
		.data([null])
		.join("g")
		.attr("class", "y-axis-right")
		.attr("transform", `translate(${innerW},0)`)
		.call(yAxisRight)
		.call((a) => a.select(".domain").attr("stroke", "#334155"))
		.call((a) => a.selectAll(".tick line").attr("stroke", "none"))
		.call((a) =>
			a.selectAll(".tick text").attr("fill", "#64748b").attr("font-size", "10"),
		);

	// X-axis label
	g.selectAll<SVGTextElement, unknown>("text.x-label")
		.data([null])
		.join("text")
		.attr("class", "x-label")
		.attr("x", innerW / 2)
		.attr("y", innerH + 30)
		.attr("fill", "#475569")
		.attr("text-anchor", "middle")
		.attr("font-size", "10")
		.text("Epoch");

	if (data.length < 2) return;

	// Line generators
	const lineTrainLoss = d3
		.line<MetricsHistoryPoint>()
		.x((d) => xScale(d.epoch))
		.y((d) => yLoss(d.trainLoss))
		.curve(d3.curveMonotoneX);

	const lineValLoss = d3
		.line<MetricsHistoryPoint>()
		.x((d) => xScale(d.epoch))
		.y((d) => yLoss(d.valLoss))
		.curve(d3.curveMonotoneX);

	const lineTrainAcc = d3
		.line<MetricsHistoryPoint>()
		.x((d) => xScale(d.epoch))
		.y((d) => yAcc(d.trainAccuracy))
		.curve(d3.curveMonotoneX);

	const lineValAcc = d3
		.line<MetricsHistoryPoint>()
		.x((d) => xScale(d.epoch))
		.y((d) => yAcc(d.valAccuracy))
		.curve(d3.curveMonotoneX);

	type LineSpec = {
		key: string;
		line: d3.Line<MetricsHistoryPoint>;
		stroke: string;
		dash: string;
	};

	const lines: LineSpec[] = [
		{ key: "train-loss", line: lineTrainLoss, stroke: "#3b82f6", dash: "none" },
		{ key: "val-loss", line: lineValLoss, stroke: "#93c5fd", dash: "5,3" },
		{
			key: "train-acc",
			line: lineTrainAcc,
			stroke: "#22c55e",
			dash: "none",
		},
		{ key: "val-acc", line: lineValAcc, stroke: "#86efac", dash: "5,3" },
	];

	for (const spec of lines) {
		g.selectAll<SVGPathElement, unknown>(`path.${spec.key}`)
			.data([data])
			.join("path")
			.attr("class", spec.key)
			.attr("fill", "none")
			.attr("stroke", spec.stroke)
			.attr("stroke-width", 1.5)
			.attr("stroke-dasharray", spec.dash)
			.attr("d", spec.line);
	}

	// Overfitting divergence annotation
	if (overfittingMode && data.length >= 4) {
		let minValLoss = Infinity;
		let divergeEpoch = -1;
		for (const pt of data) {
			if (pt.valLoss < minValLoss) minValLoss = pt.valLoss;
		}
		// Find 3 consecutive epochs where val loss is rising above minimum
		let riseCount = 0;
		for (let i = 1; i < data.length; i++) {
			if (
				data[i].valLoss > data[i - 1].valLoss &&
				data[i].valLoss > minValLoss
			) {
				riseCount++;
				if (riseCount >= 3 && divergeEpoch === -1) {
					divergeEpoch = data[i - 2].epoch;
				}
			} else {
				riseCount = 0;
			}
		}

		if (divergeEpoch >= 0) {
			const dx = xScale(divergeEpoch);
			g.selectAll<SVGLineElement, unknown>("line.diverge")
				.data([null])
				.join("line")
				.attr("class", "diverge")
				.attr("x1", dx)
				.attr("x2", dx)
				.attr("y1", 0)
				.attr("y2", innerH)
				.attr("stroke", "#f97316")
				.attr("stroke-width", 1.5)
				.attr("stroke-dasharray", "4,3");

			g.selectAll<SVGTextElement, unknown>("text.diverge-label")
				.data([null])
				.join("text")
				.attr("class", "diverge-label")
				.attr("x", dx + 4)
				.attr("y", 14)
				.attr("fill", "#f97316")
				.attr("font-size", "9")
				.text("Divergence");
		} else {
			g.selectAll("line.diverge").remove();
			g.selectAll("text.diverge-label").remove();
		}
	}

	// Legend
	type LegendItem = { label: string; stroke: string; dash: string };
	const legend: LegendItem[] = [
		{ label: "Train loss", stroke: "#3b82f6", dash: "none" },
		{ label: "Val loss", stroke: "#93c5fd", dash: "5,3" },
		{ label: "Train acc", stroke: "#22c55e", dash: "none" },
		{ label: "Val acc", stroke: "#86efac", dash: "5,3" },
	];

	const legendG = g
		.selectAll<SVGGElement, unknown>("g.legend")
		.data([null])
		.join("g")
		.attr("class", "legend")
		.attr("transform", `translate(${innerW - 72}, 4)`);

	const legendItems = legendG
		.selectAll<SVGGElement, LegendItem>("g.legend-item")
		.data(legend)
		.join("g")
		.attr("class", "legend-item")
		.attr("transform", (_, i) => `translate(0, ${i * 14})`);

	legendItems
		.selectAll<SVGLineElement, LegendItem>("line")
		.data((d) => [d])
		.join("line")
		.attr("x1", 0)
		.attr("x2", 12)
		.attr("y1", 0)
		.attr("y2", 0)
		.attr("stroke", (d) => d.stroke)
		.attr("stroke-width", 1.5)
		.attr("stroke-dasharray", (d) => d.dash);

	legendItems
		.selectAll<SVGTextElement, LegendItem>("text")
		.data((d) => [d])
		.join("text")
		.attr("x", 16)
		.attr("y", 4)
		.attr("fill", "#64748b")
		.attr("font-size", "9")
		.text((d) => d.label);

	// Tooltip overlay
	const bisect = d3.bisector<MetricsHistoryPoint, number>((d) => d.epoch).left;

	// Crosshair line
	const crosshair = g
		.selectAll<SVGLineElement, unknown>("line.crosshair")
		.data([null])
		.join("line")
		.attr("class", "crosshair")
		.attr("y1", 0)
		.attr("y2", innerH)
		.attr("stroke", "#475569")
		.attr("stroke-width", 1)
		.attr("stroke-dasharray", "3,2")
		.style("display", "none");

	// Tooltip box
	const tooltipG = g
		.selectAll<SVGGElement, unknown>("g.tooltip")
		.data([null])
		.join("g")
		.attr("class", "tooltip")
		.style("display", "none");

	const tooltipRect = tooltipG
		.selectAll<SVGRectElement, unknown>("rect")
		.data([null])
		.join("rect")
		.attr("fill", "#0f172a")
		.attr("stroke", "#334155")
		.attr("rx", 4);

	const tooltipText = tooltipG
		.selectAll<SVGTextElement, unknown>("text")
		.data([null])
		.join("text")
		.attr("fill", "#cbd5e1")
		.attr("font-size", "10")
		.attr("font-family", "monospace");

	// Invisible overlay for mouse events
	g.selectAll<SVGRectElement, unknown>("rect.overlay")
		.data([null])
		.join("rect")
		.attr("class", "overlay")
		.attr("width", innerW)
		.attr("height", innerH)
		.attr("fill", "transparent")
		.on("mousemove", (event: MouseEvent) => {
			const [mx] = d3.pointer(event);
			const epoch = xScale.invert(mx);
			const idx = Math.max(
				0,
				Math.min(data.length - 1, bisect(data, epoch, 1) - 1),
			);
			const pt = data[idx];
			if (!pt) return;

			const cx = xScale(pt.epoch);
			crosshair.attr("x1", cx).attr("x2", cx).style("display", null);

			const lines2 = [
				`E${pt.epoch}`,
				`TL ${pt.trainLoss.toFixed(3)}`,
				`VL ${pt.valLoss.toFixed(3)}`,
				`TA ${(pt.trainAccuracy * 100).toFixed(1)}%`,
				`VA ${(pt.valAccuracy * 100).toFixed(1)}%`,
			];

			const textEl = tooltipText.node();
			if (!textEl) return;

			tooltipText
				.selectAll<SVGTSpanElement, string>("tspan")
				.data(lines2)
				.join("tspan")
				.attr("x", 6)
				.attr("dy", (_, i) => (i === 0 ? 12 : 11))
				.text((d) => d);

			const bbox = textEl.getBBox();
			tooltipRect
				.attr("width", bbox.width + 12)
				.attr("height", bbox.height + 8);

			let tx = cx + 8;
			if (tx + bbox.width + 20 > innerW) tx = cx - bbox.width - 20;

			tooltipG
				.attr("transform", `translate(${tx}, ${innerH / 2 - 30})`)
				.style("display", null);
		})
		.on("mouseleave", () => {
			crosshair.style("display", "none");
			tooltipG.style("display", "none");
		});
}

export function LossCurveChart() {
	const containerRef = useRef<HTMLDivElement>(null);
	const metricsHistory = useTrainingStore((s) => s.metricsHistory);
	const totalEpochs = useTrainingStore((s) => s.trainingConfig.epochs);
	const overfittingMode = useUIStore((s) => s.overfittingMode);

	useEffect(() => {
		if (!containerRef.current) return;
		renderChart(
			containerRef.current,
			metricsHistory,
			totalEpochs,
			overfittingMode,
		);
	}, [metricsHistory, totalEpochs, overfittingMode]);

	return (
		<div className="flex flex-col h-full">
			<p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1 flex-shrink-0">
				Loss / Accuracy
			</p>
			{metricsHistory.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-xs text-slate-600">Train to see metrics</p>
				</div>
			) : (
				<div ref={containerRef} className="flex-1 min-h-0" />
			)}
		</div>
	);
}
