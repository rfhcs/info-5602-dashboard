"use client";

/**
 * RQ2: Which time of year is busiest, and does busy mean delayed?
 *
 * Follows explore.ipynb: flights per day (not counts) and rates, each calendar
 * month averaged across years, cancellations shown beside delays, a scatter that
 * tests "busy = delayed", and the cause-by-month breakdown.
 */

import { useState } from "react";
import { extent, format, line, max, min, scaleLinear, type ScaleLinear } from "d3";
import type { MonthAvg, MonthRow } from "@/lib/data";
import { CAUSE_COLOR, CAUSE_LABEL, MONTHS, UI, type Cause } from "@/lib/theme";
import { ChartCard } from "@/components/charts/chart-card";
import { Section } from "@/components/charts/section";
import {
  ChartTooltip,
  GridX,
  GridY,
  Legend,
  TipRow,
  TipTitle,
  columnPath,
  useTooltip,
  useWidth,
} from "@/components/charts/primitives";
import { usePeriod } from "@/lib/period";

const pct1 = (v: number) => `${v.toFixed(1)}%`;
const pct0 = (v: number) => `${Math.round(v)}%`;
const thousands = format(",.0f");
const kfmt = (v: number) => `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;

/** Notable months, captioned on the cancellation panel and named in its tooltip. Confirmed events. */
const EVENTS: { year: number; month: number; label?: string; name: string }[] = [
  { year: 2024, month: 1, name: "winter storm" }, // labelled jointly with Jan 2026
  { year: 2024, month: 7, label: "CrowdStrike IT outage ’24", name: "CrowdStrike IT outage" },
  { year: 2026, month: 1, label: "Winter storms, Jan ’24 & ’26", name: "winter storm" },
];

export default function RQ2Seasonality({ months, monthAvg }: { months: MonthRow[]; monthAvg: MonthAvg[] }) {
  const peak = monthAvg.reduce((a, b) => (b.delayRate > a.delayRate ? b : a));
  const low = monthAvg.reduce((a, b) => (b.delayRate < a.delayRate ? b : a));
  const busiest = monthAvg.reduce((a, b) => (b.flightsPerDay > a.flightsPerDay ? b : a));
  const quietest = monthAvg.reduce((a, b) => (b.flightsPerDay < a.flightsPerDay ? b : a));
  const r = pearson(months.map((d) => d.volumeVsYearAvg), months.map((d) => d.delayRate));

  return (
    <Section
      id="seasons"
      number={2}
      question="Which time of year is busiest, and does busy mean delayed?"
      answer={
        <>
          Flight volume barely changes through the year, but delays nearly double from fall to summer. Summer is the
          worst season, not the holidays.
        </>
      }
      stats={[
        {
          label: "Flights per day, busiest vs quietest month",
          value: `+${Math.round((busiest.flightsPerDay / quietest.flightsPerDay - 1) * 100)}%`,
          context: `${MONTHS[busiest.month - 1]} vs ${MONTHS[quietest.month - 1]}`,
        },
        {
          label: "Arrivals delayed, best vs worst month",
          value: `${pct0(low.delayRate)} → ${pct0(peak.delayRate)}`,
          context: `${MONTHS[low.month - 1]} → ${MONTHS[peak.month - 1]}`,
        },
        {
          label: "Correlation, flight volume vs delay rate",
          value: `r = ${r.toFixed(2)}`,
          context: "Busier months are only somewhat more delayed",
        },
      ]}
    >
      <SeasonPanels months={months} monthAvg={monthAvg} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BusyVsDelayed months={months} />
        <CauseByMonth monthAvg={monthAvg} />
      </div>
    </Section>
  );
}

/* ================================================================ Chart A
   Three small multiples sharing one month axis (never a dual axis).
   Navy = average across years; faint lines = each year; red dots = events. */

type Metric = { key: "flightsPerDay" | "delayRate" | "cancelRate"; title: string; fmt: (v: number) => string; tick: (v: number) => string };
const METRICS: Metric[] = [
  { key: "flightsPerDay", title: "Flights per day", fmt: thousands, tick: kfmt },
  { key: "delayRate", title: "% of arrivals delayed ≥15 min", fmt: pct1, tick: pct0 },
  { key: "cancelRate", title: "% of arrivals cancelled (not counted as delays)", fmt: pct1, tick: (v) => `${v}%` },
];

function SeasonPanels({ months, monthAvg }: { months: MonthRow[]; monthAvg: MonthAvg[] }) {
  const period = usePeriod();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null); // month 1–12
  // The side note for December needs ~130px; on narrow screens it's dropped
  // and the plot takes the full width.
  const sideNote = width >= 600;
  const m = { top: 8, right: sideNote ? 132 : 16, bottom: 44, left: 48 };
  const panelH = 118;
  const panelGap = 46;
  const innerW = Math.max(200, width - m.left - m.right);
  const innerH = METRICS.length * panelH + (METRICS.length - 1) * panelGap;
  const x = scaleLinear().domain([1, 12]).range([0, innerW]);
  const years = [...new Set(months.map((d) => d.year))].sort();

  const dec = monthAvg[11];

  return (
    <ChartCard
      title="Volume varies by about 15%; the delay rate swings by about 70%"
      subtitle={`Each calendar month averaged across ${period.years}; faint lines show individual years`}
      legend={
        <Legend
          items={[
            { label: "Average across years", color: UI.primary, shape: "line" },
            { label: "Individual years", color: UI.stone, shape: "line" },
            { label: "Notable event", color: UI.tertiary, shape: "dot" },
          ]}
        />
      }
    >
      <div ref={ref} data-chart="" className="relative">
        <svg
          width={width}
          height={innerH + m.top + m.bottom}
          role="img"
          aria-label="Flights per day, delay rate and cancellation rate by month"
        >
          <g transform={`translate(${m.left},${m.top})`}>
            {METRICS.map((metric, i) => {
              const top = i * (panelH + panelGap);
              const vals = months.map((d) => d[metric.key]);
              const lo = min(vals)!;
              const hi = max(vals)!;
              const y = scaleLinear()
                .domain(metric.key === "flightsPerDay" ? [lo * 0.97, hi * 1.02] : [0, hi])
                .nice(4)
                .range([panelH, 18]);
              const path = line<{ month: number; v: number }>()
                .x((d) => x(d.month))
                .y((d) => y(d.v));
              const avg = monthAvg.map((d) => ({ month: d.month, v: d[metric.key] }));
              const hiM = avg.reduce((a, b) => (b.v > a.v ? b : a));
              const loM = avg.reduce((a, b) => (b.v < a.v ? b : a));
              return (
                <g key={metric.key} transform={`translate(0,${top})`}>
                  <text y={4} style={{ fill: UI.ink, fontSize: 12.5, fontWeight: 500 }}>
                    {metric.title}
                  </text>
                  <GridY ticks={y.ticks(3)} y={y} width={innerW} format={metric.tick} />
                  {years.map((yr) => (
                    <path
                      key={yr}
                      d={path(months.filter((d) => d.year === yr).map((d) => ({ month: d.month, v: d[metric.key] }))) ?? ""}
                      fill="none"
                      stroke={UI.stone}
                      strokeWidth={1.25}
                      strokeOpacity={0.85}
                    />
                  ))}
                  <path d={path(avg) ?? ""} fill="none" stroke={UI.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {/* label only the extremes */}
                  {[hiM, loM].map((d, j) => (
                    <g key={j} transform={`translate(${x(d.month)},${y(d.v)})`}>
                      <circle r={4} fill={UI.primary} stroke={UI.surface} strokeWidth={2} />
                      <text
                        // edge months anchor inward; the Jan cancellation peak goes below (events sit above)
                        x={d.month === 1 ? 8 : d.month === 12 ? -8 : 0}
                        y={j === 0 && !(metric.key === "cancelRate" && d.month === 1) ? -10 : 18}
                        textAnchor={d.month === 1 ? "start" : d.month === 12 ? "end" : "middle"}
                        className="tabular"
                        style={{ fill: UI.ink, fontSize: 11.5, fontWeight: 500 }}
                      >
                        {metric.fmt(d.v)}
                      </text>
                    </g>
                  ))}
                  {/* December callout on the delay panel */}
                  {metric.key === "delayRate" && sideNote && (
                    <text x={innerW + 10} y={y(dec.delayRate)} dy="0.32em" style={{ fill: UI.ink2, fontSize: 11 }}>
                      <tspan x={innerW + 10}>Dec: delays up,</tspan>
                      <tspan x={innerW + 10} dy="1.2em">flights down</tspan>
                    </text>
                  )}
                  {/* events on the cancellation panel */}
                  {metric.key === "cancelRate" &&
                    EVENTS.map((ev, k) => {
                      const d = months.find((r) => r.year === ev.year && r.month === ev.month);
                      if (!d) return null;
                      const cx = x(d.month);
                      const cy = y(d.cancelRate);
                      const right = d.month < 7;
                      return (
                        <g key={k}>
                          <circle cx={cx} cy={cy} r={4.5} fill={UI.tertiary} stroke={UI.surface} strokeWidth={2} />
                          {ev.label && (
                            <text
                              x={right ? cx + 10 : cx}
                              y={right ? cy : cy - 11}
                              dy={right ? "0.32em" : 0}
                              textAnchor={right ? "start" : "middle"}
                              style={{ fill: UI.ink2, fontSize: 11 }}
                            >
                              {ev.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  {/* crosshair dot */}
                  {hover && (
                    <circle
                      cx={x(hover)}
                      cy={y(monthAvg[hover - 1][metric.key])}
                      r={4.5}
                      fill={UI.primary}
                      stroke={UI.surface}
                      strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}

            {/* shared month axis */}
            <g transform={`translate(0,${innerH})`}>
              {MONTHS.map((mo, i) => (
                <text key={mo} x={x(i + 1)} y={18} textAnchor="middle" style={{ fill: UI.ink3, fontSize: 11 }}>
                  {width < 520 ? mo[0] : mo}
                </text>
              ))}
              <text x={innerW / 2} y={36} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11.5 }}>
                Month (average across {period.years})
              </text>
            </g>

            {/* crosshair: snaps to the nearest month across all three panels */}
            {hover && <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke={UI.ink} strokeOpacity={0.35} />}
            <rect
              width={innerW}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              aria-label="Inspect a month (use arrow keys)"
              style={{ outline: "none" }}
              onPointerMove={(e) => {
                const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                setHover(Math.max(1, Math.min(12, Math.round(x.invert(e.clientX - r.left)))));
              }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover((h) => h ?? 1)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") setHover((h) => Math.min(12, (h ?? 0) + 1));
                if (e.key === "ArrowLeft") setHover((h) => Math.max(1, (h ?? 2) - 1));
              }}
            />
          </g>
        </svg>
        <ChartTooltip
          tip={
            hover
              ? {
                  x: m.left + x(hover),
                  y: m.top + panelH,
                  content: (
                    <>
                      <TipTitle>{MONTHS[hover - 1]} (average)</TipTitle>
                      <TipRow color={UI.primary} value={thousands(monthAvg[hover - 1].flightsPerDay)} label="flights / day" />
                      <TipRow color={UI.primary} value={pct1(monthAvg[hover - 1].delayRate)} label="delayed" />
                      <TipRow color={UI.primary} value={pct1(monthAvg[hover - 1].cancelRate)} label="cancelled" />
                      {EVENTS.filter((ev) => ev.month === hover).map((ev) => (
                        <TipRow
                          key={ev.year}
                          color={UI.tertiary}
                          shape="dot"
                          value={pct1(months.find((d) => d.year === ev.year && d.month === ev.month)?.cancelRate ?? 0)}
                          label={`cancelled in ${MONTHS[ev.month - 1]} ${ev.year} (${ev.name})`}
                        />
                      ))}
                    </>
                  ),
                }
              : null
          }
        />
      </div>
    </ChartCard>
  );
}

/* ================================================================ Chart B
   Busy ≠ delayed. Emphasis form: October (navy) and June–July (red) against
   every other month in stone. Clusters are labelled, not individual dots.   */

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function BusyVsDelayed({ months }: { months: MonthRow[] }) {
  const [ref, width] = useWidth(520);
  const { tip, bind, svgProps } = useTooltip({ order: "x" });
  const m = { top: 22, right: 16, bottom: 52, left: 60 };
  const innerW = Math.max(200, width - m.left - m.right);
  const innerH = 300;
  const [x0, x1] = extent(months, (d) => d.volumeVsYearAvg) as [number, number];
  const [y0, y1] = extent(months, (d) => d.delayRate) as [number, number];
  // nice() and ticks() use the same count, so the plot edges land exactly on gridlines
  const TICKS = 5;
  const x = scaleLinear().domain([x0, x1]).nice(TICKS).range([0, innerW]);
  const y = scaleLinear().domain([y0, y1]).nice(TICKS).range([innerH, 0]);
  const r = pearson(months.map((d) => d.volumeVsYearAvg), months.map((d) => d.delayRate));

  const group = (d: MonthRow) => (d.month === 10 ? "oct" : d.month === 6 || d.month === 7 ? "summer" : "other");
  const color = { oct: UI.primary, summer: UI.tertiary, other: UI.stone };
  const centroid = (g: string) => {
    const pts = months.filter((d) => group(d) === g);
    return [pts.reduce((a, d) => a + d.volumeVsYearAvg, 0) / pts.length, pts.reduce((a, d) => a + d.delayRate, 0) / pts.length];
  };
  const [, oy] = centroid("oct");
  const [, sy] = centroid("summer");
  // cluster labels sit beside their cluster, never on top of the dots
  const ox = max(months.filter((d) => group(d) === "oct"), (d) => d.volumeVsYearAvg)!;
  const sx = min(months.filter((d) => group(d) === "summer"), (d) => d.volumeVsYearAvg)!;
  // draw context first so highlighted dots sit on top
  const ordered = [...months].sort((a, b) => (group(a) === "other" ? -1 : 1) - (group(b) === "other" ? -1 : 1));


  return (
    <ChartCard
      title="October is as busy as May but has the fewest delays"
      subtitle={<>Each dot is one month of one year. Correlation r = {r.toFixed(2)}: busier months are only somewhat more delayed.</>}
      legend={
        <Legend
          items={[
            { label: "June – July", color: UI.tertiary, shape: "dot" },
            { label: "October", color: UI.primary, shape: "dot" },
            { label: "Other months", color: UI.stone, shape: "dot" },
          ]}
        />
      }
    >
      <div ref={ref} data-chart="" className="relative">
        <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label="Volume versus delay rate by month">
          <g transform={`translate(${m.left},${m.top})`}>
            <GridY ticks={y.ticks(TICKS)} y={y} width={innerW} format={pct0} />
            <GridX ticks={x.ticks(TICKS)} x={x} height={innerH} format={(v) => `${v > 0 ? "+" : ""}${v}%`} />
            {/* axis lines on the plot edges */}
            <line x1={0} x2={0} y1={0} y2={innerH} stroke={UI.baseline} />
            <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={UI.baseline} />
            {/* reference: a month exactly as busy as its year's average */}
            <line x1={x(0)} x2={x(0)} y1={0} y2={innerH} stroke={UI.ink} strokeOpacity={0.4} />
            <text x={x(0)} y={-8} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11 }}>
              Year average
            </text>
            {/* axis titles */}
            <text x={innerW / 2} y={innerH + 38} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11.5 }}>
              Flights per day vs. that year&rsquo;s average
            </text>
            <text
              transform={`translate(${-46},${innerH / 2}) rotate(-90)`}
              textAnchor="middle"
              style={{ fill: UI.ink2, fontSize: 11.5 }}
            >
              % of arrivals delayed ≥15 min
            </text>
            {ordered.map((d) => {
              const g = group(d);
              return (
                <g
                  key={`${d.year}-${d.month}`}
                  {...bind(
                    m.left + x(d.volumeVsYearAvg),
                    m.top + y(d.delayRate),
                    <>
                      <TipTitle>
                        {MONTHS[d.month - 1]} {d.year}
                      </TipTitle>
                      <TipRow color={color[g]} shape="dot" value={pct1(d.delayRate)} label="delayed" />
                      <TipRow value={`${d.volumeVsYearAvg > 0 ? "+" : ""}${d.volumeVsYearAvg.toFixed(1)}%`} label="flights/day vs year avg" />
                    </>,
                  )}
                >
                  <circle cx={x(d.volumeVsYearAvg)} cy={y(d.delayRate)} r={12} fill="transparent" />
                  <circle cx={x(d.volumeVsYearAvg)} cy={y(d.delayRate)} r={g === "other" ? 4.5 : 5.5} fill={color[g]} stroke={UI.surface} strokeWidth={2} />
                </g>
              );
            })}
            <text x={x(ox) + 12} y={y(oy)} dy="0.32em" textAnchor="start" style={{ fill: UI.ink, fontSize: 11.5, fontWeight: 500 }}>
              October
            </text>
            <text x={x(sx) - 12} y={y(sy)} dy="0.32em" textAnchor="end" style={{ fill: UI.ink, fontSize: 11.5, fontWeight: 500 }}>
              June – July
            </text>
          </g>
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

/* ================================================================ Chart C
   What drives the swing: delay minutes per flight, by cause and month.
   Small multiples in the fixed cause colours; June–July at full strength,
   other months faded (pre-attentive emphasis on the summer peak).
   Security is omitted (~0.2% of minutes).                                  */

const SEASON_CAUSES: Cause[] = ["late_aircraft", "carrier", "weather", "nas"];

function CauseByMonth({ monthAvg }: { monthAvg: MonthAvg[] }) {
  const [ref, width] = useWidth(520);
  const ratio = (c: Cause) => max(monthAvg, (d) => d.mpf[c])! / min(monthAvg, (d) => d.mpf[c])!;
  const most = SEASON_CAUSES.reduce((a, b) => (ratio(b) > ratio(a) ? b : a));
  const cols = width < 420 ? 1 : 2;
  const panelW = (width - (cols - 1) * 20) / cols;


  return (
    <ChartCard
      title={`Every cause rises in June–July; ${CAUSE_LABEL[most].toLowerCase()} swings the most (×${ratio(most).toFixed(1)})`}
      subtitle="Delay minutes per scheduled flight, average of each calendar month. Each panel has its own scale."
    >
      <div ref={ref} data-chart="" className="grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {SEASON_CAUSES.map((c) => (
          <CausePanel key={c} cause={c} monthAvg={monthAvg} width={Math.floor(panelW)} ratio={ratio(c)} />
        ))}
      </div>
    </ChartCard>
  );
}

function CausePanel({ cause, monthAvg, width, ratio }: { cause: Cause; monthAvg: MonthAvg[]; width: number; ratio: number }) {
  const { tip, bind, svgProps } = useTooltip();
  const m = { top: 34, right: 4, bottom: 36, left: 44 };
  const innerW = Math.max(100, width - m.left - m.right);
  const innerH = 92;
  const y: ScaleLinear<number, number> = scaleLinear()
    .domain([0, max(monthAvg, (d) => d.mpf[cause])! * 1.05])
    .nice(3)
    .range([innerH, 0]);
  const step = innerW / 12;
  const bw = Math.min(16, step - 3);
  const summer = (mo: number) => mo === 6 || mo === 7;

  return (
    <div className="relative">
      <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label={`${CAUSE_LABEL[cause]} by month`}>
        <text x={0} y={12} style={{ fill: UI.ink, fontSize: 12, fontWeight: 500 }}>
          {CAUSE_LABEL[cause]}
        </text>
        <text x={width} y={12} textAnchor="end" className="tabular" style={{ fill: UI.ink2, fontSize: 11 }}>
          peak/low ×{ratio.toFixed(1)}
        </text>
        <g transform={`translate(${m.left},${m.top})`}>
          <GridY ticks={y.ticks(2)} y={y} width={innerW} format={(v) => String(v)} />
          {monthAvg.map((d) => {
            const xx = d.month * step - step / 2 - bw / 2;
            return (
              <g
                key={d.month}
                {...bind(
                  m.left + xx + bw / 2,
                  m.top + y(d.mpf[cause]),
                  <>
                    <TipTitle>
                      {CAUSE_LABEL[cause]} · {MONTHS[d.month - 1]}
                    </TipTitle>
                    <TipRow color={CAUSE_COLOR[cause]} value={d.mpf[cause].toFixed(2)} label="delay min per flight" />
                  </>,
                )}
              >
                <rect x={xx - 1.5} y={0} width={bw + 3} height={innerH} fill="transparent" />
                <path
                  d={columnPath(xx, bw, innerH, y(d.mpf[cause]), 3)}
                  fill={CAUSE_COLOR[cause]}
                  fillOpacity={summer(d.month) ? 1 : 0.38}
                />
              </g>
            );
          })}
          <line x2={innerW} y1={innerH} y2={innerH} stroke={UI.baseline} />
          {[1, 4, 7, 10].map((mo) => (
            <text key={mo} x={mo * step - step / 2} y={innerH + 14} textAnchor="middle" style={{ fill: UI.ink3, fontSize: 10.5 }}>
              {MONTHS[mo - 1]}
            </text>
          ))}
          {/* axis titles */}
          <text x={innerW / 2} y={innerH + 30} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11 }}>
            Month
          </text>
          <text
            transform={`translate(${-30},${innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            style={{ fill: UI.ink2, fontSize: 11 }}
          >
            Min per flight
          </text>
        </g>
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
