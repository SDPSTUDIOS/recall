"use client";

import { useMemo, useState } from "react";
import type { ChartSpec } from "@/lib/types";
import { cx } from "../ui";

const W = 640;
const H = 340;
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
// Scatter markers also differ by shape, so series never rely on colour alone.
const SHAPES = ["circle", "square", "diamond"] as const;

/** Evenly spaced round-number ticks covering [min, max]. */
function niceScale(min: number, max: number, count = 5) {
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { lo, hi, ticks };
}

export function fmtNum(n: number): string {
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a >= 1e6 || a < 1e-3) return n.toExponential(2).replace(/\.?0+e/, "e");
  return Number(n.toPrecision(6)).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/** A bar with a 4px rounded data end and a square baseline end. */
function barPath(x: number, base: number, end: number, w: number) {
  const top = Math.min(base, end);
  const bottom = Math.max(base, end);
  const r = Math.min(4, bottom - top, w / 2);
  return end <= base
    ? `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`
    : `M${x},${top}H${x + w}V${bottom - r}Q${x + w},${bottom} ${x + w - r},${bottom}H${x + r}Q${x},${bottom} ${x},${bottom - r}Z`;
}

function Marker({ shape, x, y, color }: { shape: (typeof SHAPES)[number]; x: number; y: number; color: string }) {
  // The surface-coloured ring keeps overlapping markers apart.
  const ring = "stroke-white dark:stroke-zinc-900";
  if (shape === "square") return <rect x={x - 4} y={y - 4} width={8} height={8} rx={1} fill={color} strokeWidth={2} className={ring} />;
  if (shape === "diamond") return <path d={`M${x},${y - 5.5}L${x + 5.5},${y}L${x},${y + 5.5}L${x - 5.5},${y}Z`} fill={color} strokeWidth={2} className={ring} />;
  return <circle cx={x} cy={y} r={4.5} fill={color} strokeWidth={2} className={ring} />;
}

interface Hover {
  px: number;
  py: number;
  heading: string;
  rows: { name: string; value: string; color: string; shape: (typeof SHAPES)[number] }[];
  guideX?: number;
  points?: { x: number; y: number; i: number }[];
}

export function Chart({ chart, title }: { chart: ChartSpec; title?: string }) {
  const { type, series, categories } = chart;
  const multi = series.length > 1;
  const endLabels = type === "line" && multi;
  const M = { top: 14, right: endLabels ? 104 : 20, bottom: chart.xLabel ? 52 : 34, left: chart.yLabel ? 70 : 52 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const [hover, setHover] = useState<Hover | null>(null);

  const geo = useMemo(() => {
    const ys = series.flatMap((s) => s.y);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    // Bars grow from zero, so zero is always on the axis.
    const yScale = type === "bar" ? niceScale(Math.min(0, yMin), Math.max(0, yMax)) : niceScale(yMin, yMax);
    const sy = (v: number) => M.top + plotH - ((v - yScale.lo) / (yScale.hi - yScale.lo)) * plotH;

    if (type === "bar") return { yScale, sy, xScale: null, sx: null };
    const xs = series.flatMap((s) => s.x);
    const xScale = niceScale(Math.min(...xs), Math.max(...xs), 6);
    const sx = (v: number) => M.left + ((v - xScale.lo) / (xScale.hi - xScale.lo)) * plotW;
    return { yScale, sy, xScale, sx };
  }, [series, type, M.top, M.left, plotH, plotW]);

  const { yScale, sy, xScale, sx } = geo;
  const band = type === "bar" ? plotW / categories.length : 0;
  const barW = type === "bar" ? Math.max(4, Math.min(24, (band * 0.7 - 2 * (series.length - 1)) / series.length)) : 0;
  const groupW = series.length * barW + (series.length - 1) * 2;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) * W) / rect.width;
    const py = ((e.clientY - rect.top) * H) / rect.height;
    if (px < M.left - 8 || px > W - M.right + 8 || py < M.top - 8 || py > M.top + plotH + 8) return setHover(null);

    if (type === "bar") {
      const i = Math.min(categories.length - 1, Math.max(0, Math.floor((px - M.left) / band)));
      return setHover({
        px: M.left + band * (i + 0.5),
        py: sy(Math.max(...series.map((s) => s.y[i]))),
        heading: categories[i],
        rows: series.map((s, k) => ({ name: s.name, value: fmtNum(s.y[i]), color: SERIES[k], shape: "square" })),
      });
    }

    if (type === "scatter") {
      let best: { k: number; i: number; d: number } | null = null;
      series.forEach((s, k) =>
        s.x.forEach((x, i) => {
          const d = Math.hypot(sx!(x) - px, sy(s.y[i]) - py);
          if (!best || d < best.d) best = { k, i, d };
        }),
      );
      const b = best as { k: number; i: number; d: number } | null;
      if (!b || b.d > 36) return setHover(null);
      const s = series[b.k];
      return setHover({
        px: sx!(s.x[b.i]),
        py: sy(s.y[b.i]),
        heading: s.name || "Point",
        rows: [
          { name: chart.xLabel || "x", value: fmtNum(s.x[b.i]), color: SERIES[b.k], shape: SHAPES[b.k] },
          { name: chart.yLabel || "y", value: fmtNum(s.y[b.i]), color: SERIES[b.k], shape: SHAPES[b.k] },
        ],
        points: [{ x: s.x[b.i], y: s.y[b.i], i: b.k }],
      });
    }

    // Line: a crosshair at the nearest x, reading every series there.
    let target = series[0].x[0];
    for (const s of series) for (const x of s.x) if (Math.abs(sx!(x) - px) < Math.abs(sx!(target) - px)) target = x;
    const points = series.map((s, k) => {
      let j = 0;
      s.x.forEach((x, i) => Math.abs(x - target) < Math.abs(s.x[j] - target) && (j = i));
      return { x: s.x[j], y: s.y[j], i: k };
    });
    setHover({
      px: sx!(target),
      py: Math.min(...points.map((p) => sy(p.y))),
      guideX: sx!(target),
      heading: `${chart.xLabel || "x"} = ${fmtNum(target)}`,
      rows: points.map((p) => ({ name: series[p.i].name || chart.yLabel || "y", value: fmtNum(p.y), color: SERIES[p.i], shape: SHAPES[p.i] })),
      points,
    });
  }

  // Line-end labels, spaced so they never overlap; a leader joins each to its line.
  const ends = endLabels
    ? (() => {
        const items = series
          .map((s, k) => ({ k, y: sy(s.y.at(-1)!), x: sx!(s.x.at(-1)!), label: s.name }))
          .sort((a, b) => a.y - b.y);
        for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + 15);
        const overflow = items.at(-1)!.y - (M.top + plotH);
        if (overflow > 0) items.forEach((it) => (it.y -= overflow));
        return items.map((it) => ({ ...it, ly: it.y, py: sy(series[it.k].y.at(-1)!) }));
      })()
    : [];

  const label = title || `${type === "bar" ? "Bar chart" : type === "scatter" ? "Scatter plot" : "Line graph"} of ${chart.yLabel || "y"} against ${chart.xLabel || "x"}`;

  return (
    <div>
      {multi && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          {series.map((s, k) => (
            <li key={k} className="flex items-center gap-1.5">
              <svg width="16" height="10" aria-hidden className="overflow-visible">
                {type === "line" ? (
                  <line x1="0" x2="16" y1="5" y2="5" stroke={SERIES[k]} strokeWidth="2" strokeLinecap="round" />
                ) : type === "scatter" ? (
                  <Marker shape={SHAPES[k]} x={8} y={5} color={SERIES[k]} />
                ) : (
                  <rect x="3" y="0" width="10" height="10" rx="2" fill={SERIES[k]} />
                )}
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={label}
          className="block h-auto w-full touch-pan-y select-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Gridlines and y ticks */}
          {yScale.ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} strokeWidth={1} className={t === 0 ? "stroke-zinc-400 dark:stroke-zinc-600" : "stroke-zinc-200 dark:stroke-zinc-800"} />
              <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums dark:fill-zinc-400">
                {fmtNum(t)}
              </text>
            </g>
          ))}

          {/* X axis */}
          <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} strokeWidth={1} className="stroke-zinc-300 dark:stroke-zinc-700" />
          {type === "bar"
            ? categories.map((c, i) => (
                <text key={i} x={M.left + band * (i + 0.5)} y={M.top + plotH + 16} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
                  <title>{c}</title>
                  {c.length > Math.max(4, Math.floor(band / 7)) ? `${c.slice(0, Math.max(3, Math.floor(band / 7) - 1))}…` : c}
                </text>
              ))
            : xScale!.ticks.map((t) => (
                <text key={t} x={sx!(t)} y={M.top + plotH + 16} textAnchor="middle" className="fill-zinc-500 text-[11px] tabular-nums dark:fill-zinc-400">
                  {fmtNum(t)}
                </text>
              ))}

          {chart.xLabel && (
            <text x={M.left + plotW / 2} y={H - 10} textAnchor="middle" className="fill-zinc-600 text-[12px] font-medium dark:fill-zinc-300">
              {chart.xLabel}
            </text>
          )}
          {chart.yLabel && (
            <text transform={`translate(16 ${M.top + plotH / 2}) rotate(-90)`} textAnchor="middle" className="fill-zinc-600 text-[12px] font-medium dark:fill-zinc-300">
              {chart.yLabel}
            </text>
          )}

          {hover?.guideX !== undefined && (
            <line x1={hover.guideX} x2={hover.guideX} y1={M.top} y2={M.top + plotH} strokeWidth={1} className="stroke-zinc-400 dark:stroke-zinc-500" />
          )}

          {/* Data */}
          {type === "bar" &&
            categories.map((_, i) =>
              series.map((s, k) => {
                const x = M.left + band * (i + 0.5) - groupW / 2 + k * (barW + 2);
                return (
                  <path
                    key={`${i}-${k}`}
                    d={barPath(x, sy(0), sy(s.y[i]), barW)}
                    fill={SERIES[k]}
                    className={cx("transition-opacity", hover && hover.heading !== categories[i] && "opacity-50")}
                  />
                );
              }),
            )}

          {type === "line" &&
            series.map((s, k) => (
              <g key={k}>
                <path
                  d={s.x.map((x, i) => `${i ? "L" : "M"}${sx!(x).toFixed(2)},${sy(s.y[i]).toFixed(2)}`).join("")}
                  fill="none"
                  stroke={SERIES[k]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {s.x.length <= 15 && s.x.map((x, i) => <Marker key={i} shape="circle" x={sx!(x)} y={sy(s.y[i])} color={SERIES[k]} />)}
              </g>
            ))}

          {type === "scatter" &&
            series.map((s, k) => s.x.map((x, i) => <Marker key={`${k}-${i}`} shape={SHAPES[k]} x={sx!(x)} y={sy(s.y[i])} color={SERIES[k]} />))}

          {hover?.points?.map((p) => (
            <Marker key={p.i} shape={type === "scatter" ? SHAPES[p.i] : "circle"} x={sx!(p.x)} y={sy(p.y)} color={SERIES[p.i]} />
          ))}

          {ends.map((e) => (
            <g key={e.k}>
              <line x1={e.x + 4} y1={e.py} x2={W - M.right + 10} y2={e.ly} stroke={SERIES[e.k]} strokeWidth={1} />
              <text x={W - M.right + 14} y={e.ly} dy="0.32em" className="fill-zinc-600 text-[11px] font-medium dark:fill-zinc-300">
                {e.label.length > 14 ? `${e.label.slice(0, 13)}…` : e.label}
              </text>
            </g>
          ))}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 min-w-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            style={{
              left: `${(hover.px / W) * 100}%`,
              top: `${(hover.py / H) * 100}%`,
              transform: `translate(${hover.px > W * 0.65 ? "calc(-100% - 12px)" : "12px"}, -50%)`,
            }}
          >
            <div className="mb-1 font-semibold text-zinc-800 dark:text-zinc-100">{hover.heading}</div>
            {hover.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <svg width="10" height="10" aria-hidden className="shrink-0 overflow-visible">
                  <Marker shape={r.shape} x={5} y={5} color={r.color} />
                </svg>
                <span className="flex-1">{r.name}</span>
                <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <DataTable chart={chart} />
    </div>
  );
}

/** The same data as a table: for exact values, screen readers and colour-blind readers. */
function DataTable({ chart }: { chart: ChartSpec }) {
  const { type, series, categories } = chart;
  const yName = (k: number) => series[k].name || chart.yLabel || "y";
  let head: string[];
  let rows: string[][];
  if (type === "bar") {
    head = [chart.xLabel || "", ...series.map((_, k) => yName(k))];
    rows = categories.map((c, i) => [c, ...series.map((s) => fmtNum(s.y[i]))]);
  } else {
    const xs = [...new Set(series.flatMap((s) => s.x))].sort((a, b) => a - b);
    head = [chart.xLabel || "x", ...series.map((_, k) => yName(k))];
    rows = xs.map((x) => [
      fmtNum(x),
      ...series.map((s) => {
        const i = s.x.indexOf(x);
        return i === -1 ? "" : fmtNum(s.y[i]);
      }),
    ]);
  }
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer px-1 font-medium text-muted hover:text-zinc-800 dark:hover:text-zinc-200">Show data</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full tabular-nums">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800">
            <tr>
              {head.map((h, i) => (
                <th key={i} className="px-3 py-1.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-1">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
