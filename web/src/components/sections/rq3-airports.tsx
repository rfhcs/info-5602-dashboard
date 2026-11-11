"use client";

/**
 * RQ3: Which airports experience the most delays, without drawing a population map?
 *
 * Counting delayed flights just ranks airports by size. Every fix from
 * explore.ipynb is here, each chart tagged with the fix it applies:
 *   1. Rate, not count
 *   2. Volume floor (≥100k arrivals), with a shrinkage toggle beside it
 *   3. Airline-mix adjustment (excess percentage points)
 *   4. Cause fingerprint (top airports for NAS and for extreme-weather minutes per arrival)
 *
 * The two filters at the top of the section scope every chart below them.
 */

import { useMemo, useState } from "react";
import { extent, format, max, scaleBand, scaleLinear, scaleLog } from "d3";
import type { Airport } from "@/lib/data";
import { CAUSE_COLOR, UI } from "@/lib/theme";
import { ChartCard } from "@/components/charts/chart-card";
import { Bridge, Section } from "@/components/charts/section";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ChartTooltip,
  GridX,
  GridY,
  Legend,
  TipRow,
  TipTitle,
  barPath,
  useTooltip,
  useWidth,
} from "@/components/charts/primitives";
import { usePeriod } from "@/lib/period";

const FLOOR = 100_000;
const pct1 = (v: number) => `${v.toFixed(1)}%`;
const pct0 = (v: number) => `${Math.round(v)}%`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
const commas = format(",.0f");
const shortCity = (c: string) => c.replace("West Palm Beach/Palm Beach", "West Palm Beach").replace("Dallas/Fort Worth", "Dallas–Fort Worth");

/** "San Francisco, CA" → "San Francisco". */
const cityOf = (d: Airport) => shortCity(d.city).split(",")[0];

/** The first n distinct city names, in order ("New York" counts once for LGA + JFK). */
const topCities = (rows: Airport[], n: number) => [...new Set(rows.map(cityOf))].slice(0, n);

const listNames = (xs: string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** True when most of a ranking's top rows are below the volume floor, i.e. the list is small-airport noise. */
const smallLed = (rows: Airport[]) => rows.slice(0, 5).filter((d) => d.flights < FLOOR).length >= 3;

/** An airport as shown under the current filter settings. */
type View = Airport & { rate: number; excess: number };

export default function RQ3Airports({
  airports,
  shrinkK,
  nationalDelayRate,
}: {
  airports: Airport[];
  shrinkK: number;
  nationalDelayRate: number;
}) {
  const [floor, setFloor] = useState(true);
  const [shrink, setShrink] = useState(false);
  const p = nationalDelayRate / 100;

  const sum = (xs: Airport[], f: (a: Airport) => number) => xs.reduce((s, a) => s + f(a), 0);
  const totalFlights = sum(airports, (a) => a.flights);
  const nationalMpf = {
    nas: sum(airports, (a) => a.mpf.nas * a.flights) / totalFlights,
    weather: sum(airports, (a) => a.mpf.weather * a.flights) / totalFlights,
  };

  // Shrinking blends each airport with the national value, weighted by how few
  // arrivals it has: rates (charts 1–2), excess delay (chart 3) and minutes per
  // arrival (chart 4) all use the same k.
  const view: View[] = useMemo(() => {
    const blend = (v: number, n: number, national: number) => (v * n + shrinkK * national) / (n + shrinkK);
    return airports
      .filter((a) => !floor || a.flights >= FLOOR)
      .map((a) => ({
        ...a,
        rate: shrink ? ((a.delayed + shrinkK * p) / (a.flights + shrinkK)) * 100 : a.delayRate,
        excess: shrink ? ((a.delayed - a.expDelayed) / (a.flights + shrinkK)) * 100 : a.excessPp,
        mpf: shrink
          ? {
              ...a.mpf,
              nas: blend(a.mpf.nas, a.flights, nationalMpf.nas),
              weather: blend(a.mpf.weather, a.flights, nationalMpf.weather),
            }
          : a.mpf,
      }));
  }, [airports, floor, shrink, shrinkK, p, nationalMpf.nas, nationalMpf.weather]);

  const top30 = [...airports].sort((a, b) => b.flights - a.flights).slice(0, 30);
  const top30Flights = (sum(top30, (a) => a.flights) / totalFlights) * 100;
  const top30Delays = (sum(top30, (a) => a.delayed) / sum(airports, (a) => a.delayed)) * 100;

  return (
    <Section
      id="airports"
      number={3}
      question="Which airports experience the most delays?"
      answer={
        <>
          Size doesn&rsquo;t predict delays. San Francisco, Florida and San Juan run late more often than their airlines
          do elsewhere.
        </>
      }
    >
      <Bridge>
        Counting delayed flights just ranks airports by size: the 30 busiest handle {pct0(top30Flights)} of arrivals and{" "}
        {pct0(top30Delays)} of delays, so a count map is really a population map. Every chart below applies at least
        one of four fixes:
      </Bridge>
      <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Rate, not count", "% of arrivals delayed"],
          ["Volume floor", "drop or shrink small, noisy airports"],
          ["Airline-mix adjustment", "compare to what its airlines do nationally"],
          ["Cause fingerprint", "airspace limits vs extreme weather"],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-2.5 rounded-lg bg-card px-3 py-2.5 ring-1 ring-foreground/10">
            <span className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-ink-2">
              {i + 1}
            </span>
            <span>
              <span className="font-medium">{t}</span>
              <span className="block text-xs text-ink-2">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* ---- filter row: one row, above everything it scopes ---- */}
      <>
        <div className="z-10 flex md:sticky md:top-16 flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-card/95 px-4 py-3 shadow-sm ring-1 ring-foreground/10 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Switch id="floor" checked={floor} onCheckedChange={setFloor} />
            <Label htmlFor="floor" className="text-sm font-normal">
              Only airports with ≥100k arrivals
            </Label>
          </div>
          <div className="flex items-center gap-2.5">
            <Switch id="shrink" checked={shrink} onCheckedChange={setShrink} />
            <Label htmlFor="shrink" className="text-sm font-normal">
              Shrink small airports toward the US average
            </Label>
          </div>
          <span className="text-xs text-ink-3 tabular sm:ml-auto">
            Showing {view.length} of {airports.length} airports
          </span>
        </div>
        <p className="-mt-3 px-1 text-xs leading-relaxed text-ink-3 text-pretty">
          <b className="font-medium text-ink-2">Filters apply to every chart in this section.</b> The floor removes
          airports with too few arrivals for a stable rate. Shrinking keeps every airport but blends its rate with the
          US average ({pct1(nationalDelayRate)}) in proportion to how little data it has: an airport with{" "}
          {Math.round(shrinkK)} arrivals moves halfway, while ATL barely moves. The strength (k ≈ {Math.round(shrinkK)}{" "}
          arrivals) is estimated from the data. Turn both off to see the noise that both fixes deal with.
        </p>
      </>

      <div className="grid gap-6 lg:grid-cols-2">
        <RateRanking view={view} national={nationalDelayRate} floor={floor} shrink={shrink} />
        <SizeVsRate view={view} national={nationalDelayRate} />
      </div>

      <Bridge>
        Some airports share a high delay rate because they share airlines. The next chart compares each airport with
        what its own airlines achieve nationally in the same month. What remains is the airport&rsquo;s own effect.
      </Bridge>

      <div className="grid gap-6 lg:grid-cols-2">
        <ExcessDelay view={view} />
        <Fingerprint view={view} national={nationalMpf} />
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- helpers */

/** Greedy label placement: try right, left, above, below; drop a label that still collides. */
function placeLabels(
  items: { key: string; x: number; y: number; r?: number; text: string }[],
  bounds: { w: number; h: number },
  obstacles: { x: number; y: number; r: number }[] = [],
  charW = 6.6,
) {
  const placed: { key: string; x: number; y: number; anchor: "start" | "end" | "middle"; text: string; box: number[] }[] = [];
  const hit = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  // every dot on the chart is an obstacle (not just the labelled ones), so labels never sit on a mark
  const dots = [...items.map((it) => ({ x: it.x, y: it.y, r: it.r ?? 4 })), ...obstacles].map((d) => [
    d.x - d.r,
    d.y - d.r,
    d.x + d.r,
    d.y + d.r,
  ]);
  for (const it of items) {
    const w = it.text.length * charW;
    const r = it.r ?? 4;
    const options: { dx: number; dy: number; anchor: "start" | "end" | "middle" }[] = [
      { dx: r + 4, dy: 0, anchor: "start" },
      { dx: -(r + 4), dy: 0, anchor: "end" },
      { dx: 0, dy: -(r + 9), anchor: "middle" },
      { dx: 0, dy: r + 11, anchor: "middle" },
    ];
    for (const o of options) {
      const lx = it.x + o.dx;
      const ly = it.y + o.dy;
      const x0 = o.anchor === "start" ? lx : o.anchor === "end" ? lx - w : lx - w / 2;
      const box = [x0 - 2, ly - 7, x0 + w + 2, ly + 7];
      if (box[0] < 0 || box[2] > bounds.w || box[1] < 0 || box[3] > bounds.h) continue;
      if (placed.some((p) => hit(p.box, box)) || dots.some((d) => hit(d, box))) continue;
      placed.push({ key: it.key, x: lx, y: ly, anchor: o.anchor, text: it.text, box });
      break;
    }
  }
  return placed;
}

/* ================================================================ Chart 1
   Fix 1 (+2): the 15 highest delay rates. Single series → one colour (navy).
   A hairline marks the US average.                                          */

function RateRanking({ view, national, floor, shrink }: { view: View[]; national: number; floor: boolean; shrink: boolean }) {
  const period = usePeriod();
  const [ref, width] = useWidth(520);
  const { tip, bind, svgProps } = useTooltip();
  const rows = [...view].sort((a, b) => b.rate - a.rate).slice(0, 15);
  const m = { top: 22, right: 46, bottom: 26, left: 150 };
  const innerW = Math.max(120, width - m.left - m.right);
  const innerH = rows.length * 24;
  const x = scaleLinear().domain([0, Math.max(30, max(rows, (d) => d.rate) ?? 30)]).nice().range([0, innerW]);
  const y = scaleBand<string>().domain(rows.map((d) => d.code)).range([0, innerH]).paddingInner(0.35).paddingOuter(0.1);
  const bh = Math.min(16, y.bandwidth());

  const tag = floor
    ? `Fixes 1 + 2 · rate, with a volume floor${shrink ? " and shrinkage" : ""}`
    : shrink
      ? "Fixes 1 + 2 · rate, with shrinkage"
      : "Fix 1 · rate only, no volume floor";
  const florida = rows.filter((d) => d.city.endsWith(", FL")).length;
  const title = smallLed(rows)
    ? `Without a volume floor, small airports like ${listNames(topCities(rows, 2))} top the list`
    : florida >= 3
      ? `${listNames(topCities(rows, 2))} have the highest delay rates, and ${florida} of the top ${rows.length} are in Florida`
      : `${listNames(topCities(rows, 3))} have the highest delay rates`;

  return (
    <ChartCard
      tag={tag}
      title={title}
      subtitle={`15 highest % of arrivals delayed ≥15 min, ${period.range}`}
    >
      <div ref={ref} data-chart="" className="relative">
        <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label="Airports with the highest delay rates">
          <g transform={`translate(${m.left},${m.top})`}>
            <GridX ticks={x.ticks(4)} x={x} height={innerH} format={pct0} />
            {rows.map((d) => {
              const yy = (y(d.code) ?? 0) + (y.bandwidth() - bh) / 2;
              return (
                <g
                  key={d.code}
                  {...bind(
                    m.left + x(d.rate),
                    m.top + yy + bh / 2,
                    <>
                      <TipTitle>
                        {d.code} · {d.city}
                      </TipTitle>
                      <TipRow color={UI.primary} value={pct1(d.rate)} label="of arrivals delayed" />
                      <TipRow value={commas(d.flights)} label="arrivals" />
                      {d.note && <p className="mt-1 text-ink-3">{d.note}</p>}
                    </>,
                  )}
                >
                  <rect x={-m.left} y={y(d.code)} width={width} height={y.bandwidth()} fill="transparent" />
                  <text x={-10} y={yy + bh / 2} dy="0.32em" textAnchor="end" style={{ fontSize: 12 }}>
                    <tspan style={{ fill: UI.ink, fontWeight: 500 }}>{d.code}</tspan>
                    <tspan style={{ fill: UI.ink3 }}> {shortCity(d.city).split(",")[0].slice(0, 18)}</tspan>
                  </text>
                  <path d={barPath(0, x(d.rate), yy, bh)} fill={UI.primary} />
                  <text x={x(d.rate) + 5} y={yy + bh / 2} dy="0.32em" className="tabular" style={{ fill: UI.ink, fontSize: 11.5 }}>
                    {d.rate.toFixed(1)}
                  </text>
                </g>
              );
            })}
            <line x1={x(national)} x2={x(national)} y1={-6} y2={innerH} stroke={UI.ink} strokeOpacity={0.55} />
            <text x={x(national)} y={-10} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11 }}>
              US avg {pct1(national)}
            </text>
            <line y2={innerH} stroke={UI.baseline} />
          </g>
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

/* ================================================================ Chart 2
   Fix 2 evidence: if delays tracked size, dots would climb to the right.
   Emphasis: ≥3 pts above the US average in red, ≥3 below in navy.         */

/** 1, 10, 100k… → "1", "10", "100k", "1M". */
const fmtCount = (v: number) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}k` : String(v));

/**
 * Log-axis domain and ticks whose ends sit on gridlines. Up to 2.5 decades:
 * ticks on 1-2-5 steps (100k, 200k, 500k, 1M, 2M). Wider: powers of ten.
 */
function logTicks(lo: number, hi: number) {
  const span = Math.log10(hi) - Math.log10(lo);
  const steps = span <= 2.5 ? [1, 2, 5] : [1];
  const cands: number[] = [];
  for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)) + 1; e++)
    for (const s of steps) cands.push(s * 10 ** e);
  const d0 = Math.max(...cands.filter((c) => c <= lo));
  const d1 = Math.min(...cands.filter((c) => c >= hi));
  return { domain: [d0, d1] as [number, number], ticks: cands.filter((c) => c >= d0 && c <= d1) };
}

function SizeVsRate({ view, national }: { view: View[]; national: number }) {
  const period = usePeriod();
  const [ref, width] = useWidth(520);
  const { tip, bind, svgProps } = useTooltip({ order: "x" });
  const m = { top: 12, right: 18, bottom: 52, left: 60 };
  const innerW = Math.max(200, width - m.left - m.right);
  const innerH = 330;
  const [f0, f1] = extent(view, (d) => d.flights) as [number, number];
  const [r0, r1] = extent(view, (d) => d.rate) as [number, number];
  // Both axes are snapped so the plot edges land exactly on gridlines.
  const { domain: xDomain, ticks: xTicks } = logTicks(f0, f1);
  const x = scaleLog().domain(xDomain).range([0, innerW]);
  const Y_TICKS = 5;
  const y = scaleLinear().domain([Math.min(r0, national), Math.max(r1, national)]).nice(Y_TICKS).range([innerH, 0]);

  const lx = view.map((d) => Math.log(d.flights));
  const ly = view.map((d) => d.rate);
  const r = corr(lx, ly);

  const tone = (d: View) => (d.rate >= national + 3 ? "hi" : d.rate <= national - 3 ? "lo" : "mid");
  const color = { hi: UI.tertiary, lo: UI.primary, mid: UI.stone };
  const ordered = [...view].sort((a, b) => (tone(a) === "mid" ? -1 : 1) - (tone(b) === "mid" ? -1 : 1));
  const dotR = view.length > 100 ? 3.5 : 4.5;
  const labels = placeLabels(
    [...view]
      .filter((d) => d.flights >= FLOOR && (tone(d) !== "mid" || d.sizeRank <= 4))
      .sort((a, b) => Math.abs(b.rate - national) - Math.abs(a.rate - national))
      .map((d) => ({ key: d.code, x: x(d.flights), y: y(d.rate), r: dotR, text: d.code })),
    { w: innerW, h: innerH },
    view.map((d) => ({ x: x(d.flights), y: y(d.rate), r: dotR })),
  );


  return (
    <ChartCard
      tag="Fix 2 · why a rate isn’t a population map"
      title="Bigger airports aren’t more delayed"
      subtitle={
        <>
          Arrivals (log scale) vs % delayed. Correlation r = {r.toFixed(2)}:{" "}
          {Math.abs(r) < 0.15 ? "close to none" : Math.abs(r) < 0.3 ? "weak" : "moderate"}.
        </>
      }
      legend={
        <Legend
          items={[
            { label: "≥3 pts above US average", color: UI.tertiary, shape: "dot" },
            { label: "≥3 pts below", color: UI.primary, shape: "dot" },
            { label: "Within 3 pts", color: UI.stone, shape: "dot" },
          ]}
        />
      }
    >
      <div ref={ref} data-chart="" className="relative">
        <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label="Airport size versus delay rate">
          <g transform={`translate(${m.left},${m.top})`}>
            <GridY ticks={y.ticks(Y_TICKS)} y={y} width={innerW} format={pct0} />
            <GridX ticks={xTicks} x={x} height={innerH} format={fmtCount} />
            {/* axis lines on the plot edges */}
            <line x1={0} x2={0} y1={0} y2={innerH} stroke={UI.baseline} />
            <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={UI.baseline} />
            {/* axis titles */}
            <text x={innerW / 2} y={innerH + 38} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11.5 }}>
              Arrivals, {period.range} (log scale)
            </text>
            <text
              transform={`translate(${-46},${innerH / 2}) rotate(-90)`}
              textAnchor="middle"
              style={{ fill: UI.ink2, fontSize: 11.5 }}
            >
              % of arrivals delayed ≥15 min
            </text>
            <line x2={innerW} y1={y(national)} y2={y(national)} stroke={UI.ink} strokeOpacity={0.5} />
            <text x={4} y={y(national) - 5} style={{ fill: UI.ink2, fontSize: 11 }}>
              US avg
            </text>
            {ordered.map((d) => {
              const t = tone(d);
              return (
                <g
                  key={d.code}
                  {...bind(
                    m.left + x(d.flights),
                    m.top + y(d.rate),
                    <>
                      <TipTitle>
                        {d.code} · {d.city}
                      </TipTitle>
                      <TipRow color={color[t]} shape="dot" value={pct1(d.rate)} label="delayed" />
                      <TipRow value={commas(d.flights)} label="arrivals" />
                    </>,
                  )}
                >
                  <circle cx={x(d.flights)} cy={y(d.rate)} r={10} fill="transparent" />
                  <circle cx={x(d.flights)} cy={y(d.rate)} r={dotR} fill={color[t]} stroke={UI.surface} strokeWidth={view.length > 100 ? 1 : 2} />
                </g>
              );
            })}
            {labels.map((l) => (
              <text key={l.key} x={l.x} y={l.y} dy="0.32em" textAnchor={l.anchor} style={{ fill: UI.ink2, fontSize: 10.5, pointerEvents: "none" }}>
                {l.text}
              </text>
            ))}
          </g>
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

function corr(xs: number[], ys: number[]) {
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

/* ================================================================ Chart 3
   Fix 3: excess delay vs the airline-mix expectation. Diverging bars from a
   zero baseline: red = worse than its airlines, navy = better. Top & bottom 12. */

function ExcessDelay({ view }: { view: View[] }) {
  const [ref, width] = useWidth(520);
  const { tip, bind, svgProps } = useTooltip();
  const sorted = [...view].sort((a, b) => b.excess - a.excess);
  const n = Math.min(12, Math.floor(sorted.length / 2));
  const rows = [...sorted.slice(0, n), ...sorted.slice(-n)];
  const m = { top: 8, right: 40, bottom: 26, left: 150 };
  const innerW = Math.max(140, width - m.left - m.right);
  const innerH = rows.length * 21 + 10; // +10 for the gap between the two groups
  const lim = Math.max(2, max(rows, (d) => Math.abs(d.excess)) ?? 2);
  // 18% headroom so value labels at the bar ends never run into the airport names
  const x = scaleLinear().domain([-lim * 1.18, lim * 1.18]).nice().range([0, innerW]);
  const y = (i: number) => i * 21 + (i >= n ? 10 : 0);
  const bh = 13;

  const atl = view.find((d) => d.code === "ATL");
  const [first, second] = sorted;
  const title = smallLed(sorted)
    ? `Without a volume floor, small airports like ${listNames(topCities(sorted, 2))} swing furthest from their airlines’ average`
    : second && first.excess - second.excess >= 2
      ? `${cityOf(first)} stands out: about ${Math.round(first.excess)} points worse than its airlines manage elsewhere`
      : `${listNames([cityOf(first), cityOf(second ?? first)].filter((v, i, a) => a.indexOf(v) === i))} run furthest above what their airlines manage elsewhere`;

  return (
    <ChartCard
      tag="Fix 3 · airline-mix adjustment"
      title={title}
      subtitle="Percentage points above or below what each airport’s airlines achieve nationally in the same month"
      legend={
        <Legend
          items={[
            { label: "Worse than its airlines", color: UI.tertiary },
            { label: "Better than its airlines", color: UI.primary },
          ]}
        />
      }
      footnotes={[
        {
          mark: "",
          text: (
            <>
              Several big hubs beat their own airlines&rsquo; national average.
              {atl && (
                <>
                  {" "}
                  ATL has the most arrivals in the data and sits at {signed(atl.excess)} pts.
                </>
              )}{" "}
              Rankings are fairly stable from year to year (rank correlation 0.66–0.82 between any two years), so this isn&rsquo;t noise.
            </>
          ),
        },
      ]}
    >
      <div ref={ref} data-chart="" className="relative">
        <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label="Excess delay by airport">
          <g transform={`translate(${m.left},${m.top})`}>
            <GridX ticks={x.ticks(5)} x={x} height={innerH} format={(v) => (v === 0 ? "0" : signed(v).replace(".0", ""))} />
            {rows.map((d, i) => {
              const yy = y(i) + (21 - bh) / 2;
              const pos = d.excess >= 0;
              return (
                <g
                  key={d.code}
                  {...bind(
                    m.left + x(d.excess),
                    m.top + yy + bh / 2,
                    <>
                      <TipTitle>
                        {d.code} · {d.city}
                      </TipTitle>
                      <TipRow color={pos ? UI.tertiary : UI.primary} value={`${signed(d.excess)} pts`} label="vs airline mix" />
                      <TipRow value={pct1(d.rate)} label="actually delayed" />
                      <TipRow value={pct1((d.expDelayed / d.flights) * 100)} label="expected from its airlines" />
                    </>,
                  )}
                >
                  <rect x={-m.left} y={y(i)} width={width} height={21} fill="transparent" />
                  <text x={-10} y={yy + bh / 2} dy="0.32em" textAnchor="end" style={{ fontSize: 12 }}>
                    <tspan style={{ fill: UI.ink, fontWeight: 500 }}>{d.code}</tspan>
                    <tspan style={{ fill: UI.ink3 }}> {shortCity(d.city).split(",")[0].slice(0, 18)}</tspan>
                  </text>
                  <path d={barPath(x(0), x(d.excess), yy, bh)} fill={pos ? UI.tertiary : UI.primary} />
                  <text
                    x={x(d.excess) + (pos ? 5 : -5)}
                    y={yy + bh / 2}
                    dy="0.32em"
                    textAnchor={pos ? "start" : "end"}
                    className="tabular"
                    style={{ fill: UI.ink, fontSize: 11 }}
                  >
                    {signed(d.excess)}
                  </text>
                </g>
              );
            })}
            <line x1={x(0)} x2={x(0)} y2={innerH} stroke={UI.ink2} />
          </g>
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

/* ================================================================ Chart 4
   Fix 4: the cause fingerprint. NAS minutes are the most airport-specific
   cause (runways, airspace, ATC); extreme weather is regional. Two ranked
   bar lists, one per cause, each in its fixed cause colour with a US-average
   hairline. Each panel has its own scale (NAS minutes run ~4× weather).      */

const TOP_N = 10;

function Fingerprint({ view, national }: { view: View[]; national: { nas: number; weather: number } }) {
  const sfo = view.find((d) => d.code === "SFO");
  const byNas = [...view].sort((a, b) => b.mpf.nas - a.mpf.nas);
  const byWx = [...view].sort((a, b) => b.mpf.weather - a.mpf.weather);
  // each list is judged on its own: one can be clean while the other is small-airport noise
  const nasSmall = smallLed(byNas);
  const wxSmall = smallLed(byWx);
  const title =
    nasSmall && wxSmall
      ? "Without a volume floor, small airports with few flights dominate both lists"
      : nasSmall
        ? `Small airports with few flights top the air-traffic list; ${listNames(topCities(byWx, 3))} lose the most time to extreme weather`
        : wxSmall
          ? `${listNames(topCities(byNas, 3))} lose the most time to air traffic; small airports with few flights top the extreme-weather list`
          : `${listNames(topCities(byNas, 3))} lose the most time to air traffic; ${listNames(topCities(byWx, 3))} to extreme weather`;
  return (
    <ChartCard
      tag="Fix 4 · cause fingerprint"
      title={title}
      subtitle={`Delay minutes per arrival from each cause: the ${TOP_N} highest airports for each. Each panel has its own scale.`}
      footnotes={[
        {
          mark: "",
          text: (
            <>
              NAS = air traffic control, runway capacity and congestion: the delay cause an airport has the most control
              over.{sfo && <> {pct0(sfo.share.nas)} of SFO&rsquo;s delay minutes are NAS: fog and closely spaced parallel runways cut its arrival rate.</>}{" "}
              EWR and LGA also have some of the highest cancellation rates among large airports (about 3%).
            </>
          ),
        },
      ]}
    >
      <div className="space-y-6">
        <CauseRanking view={view} cause="nas" title="Air traffic & airport (NAS)" national={national.nas} />
        <CauseRanking view={view} cause="weather" title="Extreme weather" national={national.weather} />
      </div>
    </ChartCard>
  );
}

function CauseRanking({
  view,
  cause,
  title,
  national,
}: {
  view: View[];
  cause: "nas" | "weather";
  title: string;
  national: number;
}) {
  const [ref, width] = useWidth(520);
  const { tip, bind, svgProps } = useTooltip();
  const rows = [...view].sort((a, b) => b.mpf[cause] - a.mpf[cause]).slice(0, TOP_N);
  // header (y≈13) and the "US avg" label (y≈40) each get their own row
  const m = { top: 50, right: 52, bottom: 24, left: 150 };
  const innerW = Math.max(120, width - m.left - m.right);
  const innerH = rows.length * 22;
  const x = scaleLinear().domain([0, max(rows, (d) => d.mpf[cause]) ?? 1]).nice().range([0, innerW]);
  const y = scaleBand<string>().domain(rows.map((d) => d.code)).range([0, innerH]).paddingInner(0.35).paddingOuter(0.1);
  const bh = Math.min(14, y.bandwidth());
  const color = CAUSE_COLOR[cause];

  return (
    <div ref={ref} data-chart="" className="relative">
      <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label={`${title}: delay minutes per arrival`}>
        <text x={0} y={13} style={{ fill: UI.ink, fontSize: 12.5, fontWeight: 500 }}>
          {title}
          <tspan style={{ fill: UI.ink3, fontWeight: 400 }}> · min per arrival</tspan>
        </text>
        <g transform={`translate(${m.left},${m.top})`}>
          <GridX ticks={x.ticks(4)} x={x} height={innerH} format={(v) => String(v)} />
          {rows.map((d) => {
            const yy = (y(d.code) ?? 0) + (y.bandwidth() - bh) / 2;
            const v = d.mpf[cause];
            return (
              <g
                key={d.code}
                {...bind(
                  m.left + x(v),
                  m.top + yy + bh / 2,
                  <>
                    <TipTitle>
                      {d.code} · {d.city}
                    </TipTitle>
                    <TipRow color={color} value={`${v.toFixed(2)} min`} label="per arrival" />
                    <TipRow value={pct1(d.share[cause])} label="of its delay minutes" />
                  </>,
                )}
              >
                <rect x={-m.left} y={y(d.code)} width={width} height={y.bandwidth()} fill="transparent" />
                <text x={-10} y={yy + bh / 2} dy="0.32em" textAnchor="end" style={{ fontSize: 12 }}>
                  <tspan style={{ fill: UI.ink, fontWeight: 500 }}>{d.code}</tspan>
                  <tspan style={{ fill: UI.ink3 }}> {shortCity(d.city).split(",")[0].slice(0, 18)}</tspan>
                </text>
                <path d={barPath(0, x(v), yy, bh)} fill={color} />
                <text x={x(v) + 5} y={yy + bh / 2} dy="0.32em" className="tabular" style={{ fill: UI.ink, fontSize: 11 }}>
                  {v.toFixed(1)}
                </text>
              </g>
            );
          })}
          <line x1={x(national)} x2={x(national)} y1={-6} y2={innerH} stroke={UI.ink} strokeOpacity={0.55} />
          <text x={x(national)} y={-10} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11 }}>
            US avg {national.toFixed(1)}
          </text>
          <line y2={innerH} stroke={UI.baseline} />
        </g>
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
