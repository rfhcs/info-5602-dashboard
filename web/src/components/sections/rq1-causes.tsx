"use client";

/**
 * RQ1: What is the biggest cause of flight delays?
 *
 * Two ways to measure "biggest": how many delayed flights a cause touches and
 * how many minutes it costs. A switch traces late aircraft (a knock-on effect)
 * back to the cause that started it. A second chart compares
 * late aircraft vs carrier share by airline (the cascade story).
 */

import { useState } from "react";
import { format, max, scaleBand, scaleLinear } from "d3";
import type { CauseTotal, Carrier } from "@/lib/data";
import { CAUSE_COLOR, CAUSE_LABEL, CAUSE_SHORT, UI, type Cause } from "@/lib/theme";
import { ChartCard } from "@/components/charts/chart-card";
import { Section } from "@/components/charts/section";
import {
  ChartTooltip,
  GridX,
  Legend,
  TipRow,
  TipTitle,
  barPath,
  useTooltip,
  useWidth,
} from "@/components/charts/primitives";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePeriod } from "@/lib/period";

const pct1 = (v: number) => `${v.toFixed(1)}%`;
const pct0 = (v: number) => `${Math.round(v)}%`;
const compact = format(".3~s");

export default function RQ1Causes({ causes, carriers }: { causes: CauseTotal[]; carriers: Carrier[] }) {
  const get = (c: Cause) => causes.find((d) => d.cause === c)!;
  const late = get("late_aircraft");
  const topRoot = causes.reduce((a, b) => ((b.rootShare ?? 0) > (a.rootShare ?? 0) ? b : a));

  return (
    <Section
      id="causes"
      number={1}
      question="What is the biggest cause of flight delays?"
      answer={
        <>
        Short answer: Late aircraft, but that&rsquo;s a circular cause. The airline&rsquo;s own operations cause the most delays.
        </>
      }
      stats={[
        { label: "Delay minutes from late aircraft", value: pct0(late.shareMinutes), context: "A delay passed on from the plane’s previous flight" },
        { label: `Root-cause minutes from ${CAUSE_LABEL[topRoot.cause].toLowerCase()}`, value: pct0(topRoot.rootShare ?? 0), context: "Once late aircraft is traced back to what started it" },
        {
          label: "Average extreme-weather delay",
          value: `${Math.round(get("weather").avgMinPerDelay)} min`,
          context: `Rare but long: vs ${Math.round(get("carrier").avgMinPerDelay)} for carrier, ${Math.round(get("nas").avgMinPerDelay)} for NAS`,
        },
      ]}
    >
      <CauseShares causes={causes} topRoot={topRoot.cause} />
      <CarrierMix carriers={carriers} />
    </Section>
  );
}

/* ================================================================ Chart A
   Two measures side by side, same rows, same scale so bar lengths compare
   directly across panels. Rows stay put when the switch flips so each bar
   visibly grows. Traced: late aircraft is split across the other causes in
   proportion to their own share (as in explore.ipynb); the reassigned part
   is the lighter extension of each bar.                                   */

/** A cause's share once late aircraft is redistributed; null for late aircraft itself. */
const traceBack = (share: number, cause: Cause, lateShare: number) =>
  cause === "late_aircraft" ? null : (share / (100 - lateShare)) * 100;

function CauseShares({ causes, topRoot }: { causes: CauseTotal[]; topRoot: Cause }) {
  const period = usePeriod();
  const [ref, width] = useWidth();
  const [traced, setTraced] = useState(false);
  const rows = [...causes].sort((a, b) => b.shareMinutes - a.shareMinutes);
  const late = causes.find((c) => c.cause === "late_aircraft")!;
  const stacked = width < 640; // phone/tablet: panels stack, each keeps its labels

  const flights = (r: CauseTotal) => ({ raw: r.shareFlights, root: traceBack(r.shareFlights, r.cause, late.shareFlights) });
  const minutes = (r: CauseTotal) => ({ raw: r.shareMinutes, root: traceBack(r.shareMinutes, r.cause, late.shareMinutes) });

  // one fixed scale for both states, so flipping the switch only grows bars
  const domainMax = Math.max(
    50,
    Math.ceil((max(rows, (r) => Math.max(r.shareFlights, r.shareMinutes, flights(r).root ?? 0, minutes(r).root ?? 0)) ?? 50) / 10) * 10,
  );
  // the labelled panel is wider so both bar areas come out about the same length
  const unit = (width - 24) / 2.5;
  const topRootMinutes = minutes(causes.find((c) => c.cause === topRoot)!).root ?? 0;

  return (
    <ChartCard
      title={
        traced
          ? `Traced back to where delays start, ${CAUSE_LABEL[topRoot].toLowerCase()} causes ${pct0(topRootMinutes)} of delay minutes`
          : "Late aircraft leads both measures, but it’s a delay passed on from the plane’s previous flight"
      }
      subtitle={
        traced
          ? `Late aircraft split across the other causes in proportion to their share (lighter segment), ${period.range}`
          : `Each cause’s share of delayed flights and of delay minutes, ${period.range}`
      }
      legend={
        <div className="flex items-center gap-2.5">
          <Switch id="trace-late" checked={traced} onCheckedChange={setTraced} />
          <Label htmlFor="trace-late" className="text-sm font-normal">
            Trace late aircraft back to its root cause
          </Label>
        </div>
      }
      footnotes={[
        {
          mark: "",
          text: (
            <>
              NAS = air traffic control and airport congestion; BTS also files non-extreme weather (rain, low cloud,
              wind) there, so weather&rsquo;s true share is understated.
            </>
          ),
        },
      ]}
    >
      <div ref={ref} data-chart="" className={stacked ? "space-y-6" : "grid grid-cols-[1.5fr_1fr] gap-6"}>
        <SharePanel
          rows={rows}
          value={flights}
          traced={traced}
          title="Share of delayed flights"
          detail={(r) => `${compact(r.flights)} delayed flights`}
          domainMax={domainMax}
          showLabels
          width={stacked ? width : Math.floor(unit * 1.5)}
        />
        <SharePanel
          rows={rows}
          value={minutes}
          traced={traced}
          title="Share of delay minutes"
          detail={(r) => `${compact(r.minutes)} minutes · ${Math.round(r.avgMinPerDelay)} min per delay`}
          domainMax={domainMax}
          showLabels={stacked}
          width={stacked ? width : Math.floor(unit)}
        />
      </div>
    </ChartCard>
  );
}

function SharePanel({
  rows,
  value,
  traced,
  title,
  detail,
  domainMax,
  showLabels,
  width,
}: {
  rows: CauseTotal[];
  value: (r: CauseTotal) => { raw: number; root: number | null }; // root null: late aircraft
  traced: boolean;
  title: string;
  detail: (r: CauseTotal) => string;
  domainMax: number;
  showLabels: boolean;
  width: number;
}) {
  const { tip, bind, svgProps } = useTooltip();
  const compactLabels = width < 480; // phone: short cause names, fewer ticks
  const m = { top: 28, right: 48, bottom: 26, left: showLabels ? (compactLabels ? 104 : 168) : 14 };
  const innerW = Math.max(60, width - m.left - m.right);
  const innerH = rows.length * 40;
  const x = scaleLinear().domain([0, domainMax]).range([0, innerW]);
  const y = scaleBand<Cause>()
    .domain(rows.map((r) => r.cause))
    .range([0, innerH])
    .paddingInner(0.45)
    .paddingOuter(0.2);
  const bh = Math.min(22, y.bandwidth());

  return (
    <div className="relative">
      <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label={title}>
        <text x={m.left} y={14} style={{ fill: UI.ink, fontSize: 13, fontWeight: 500 }}>
          {title}
        </text>
        <g transform={`translate(${m.left},${m.top})`}>
          <GridX ticks={x.ticks(innerW < 220 ? 3 : 5)} x={x} height={innerH} format={pct0} />
          {rows.map((r) => {
            const yy = (y(r.cause) ?? 0) + (y.bandwidth() - bh) / 2;
            const { raw, root } = value(r);
            const label = showLabels && (
              <text x={-12} y={yy + bh / 2} dy="0.32em" textAnchor="end" style={{ fill: UI.ink2, fontSize: 12.5 }}>
                {compactLabels ? CAUSE_SHORT[r.cause] : CAUSE_LABEL[r.cause]}
              </text>
            );
            if (traced && root === null)
              return (
                <g key={r.cause}>
                  <text x={6} y={yy + bh / 2} dy="0.32em" style={{ fill: UI.ink3, fontSize: 11.5 }}>
                    reassigned to its root cause
                  </text>
                  {label}
                </g>
              );
            const shown = traced && root !== null ? root : raw;
            return (
              <g
                key={r.cause}
                {...bind(
                  m.left + x(shown),
                  m.top + yy + bh / 2,
                  <>
                    <TipTitle>{CAUSE_LABEL[r.cause]}</TipTitle>
                    {traced && root !== null ? (
                      <>
                        <TipRow color={CAUSE_COLOR[r.cause]} value={pct1(root)} label="traced to root cause" />
                        <TipRow value={`${pct1(raw)} direct + ${pct1(root - raw)} via late aircraft`} label="" />
                      </>
                    ) : (
                      <TipRow color={CAUSE_COLOR[r.cause]} value={pct1(raw)} label={title.toLowerCase()} />
                    )}
                    <TipRow value={detail(r)} label="" />
                  </>,
                )}
              >
                {/* generous hit area: the whole row */}
                <rect x={-m.left} y={y(r.cause)} width={innerW + m.left + m.right} height={y.bandwidth()} fill="transparent" />
                {traced && root !== null ? (
                  <>
                    {/* reassigned late-aircraft share: lighter extension of the direct bar */}
                    <path d={barPath(0, x(root), yy, bh)} fill={CAUSE_COLOR[r.cause]} fillOpacity={0.4} />
                    <path d={barPath(0, Math.max(x(raw), 1), yy, bh, 0)} fill={CAUSE_COLOR[r.cause]} />
                  </>
                ) : (
                  <path d={barPath(0, Math.max(x(raw), 1), yy, bh)} fill={CAUSE_COLOR[r.cause]} />
                )}
                <text x={x(shown) + 6} y={yy + bh / 2} dy="0.32em" className="tabular" style={{ fill: UI.ink, fontSize: 12, fontWeight: 500 }}>
                  {pct1(shown)}
                </text>
                {label}
              </g>
            );
          })}
          <line y2={innerH} stroke={UI.baseline} />
        </g>
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}


/* ================================================================ Chart B
   Airlines: the two causes that tell the story, as two dots per airline:
   late aircraft (knock-on) vs carrier (the airline's own operations).
   Story rows stay at full strength: over half late aircraft, or carrier
   ahead of late aircraft. Everything else fades back (pre-attentive emphasis).
   Delay rate sits in a quiet text column on the right.                     */

const shortName = (n: string) =>
  n
    .replace(/ LLC.*$| Inc\.$| Corp$/, "")
    .replace(/ (Airlines|Air Lines|Airline|Airways|Air)( Network)?$/, "")
    .replace(/ Network$/, "");

const listNames = (xs: string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function CarrierMix({ carriers }: { carriers: Carrier[] }) {
  const period = usePeriod();
  const [ref, width] = useWidth();
  const { tip, bind, svgProps } = useTooltip();
  const rows = [...carriers].sort((a, b) => b.share.late_aircraft - a.share.late_aircraft);
  const narrow = width < 560;

  const story = (r: Carrier) =>
    r.share.late_aircraft >= 50 ? "late" : r.share.carrier > r.share.late_aircraft ? "carrier" : null;
  const lateHeavy = rows.filter((r) => story(r) === "late");
  const ownCause = rows.filter((r) => story(r) === "carrier");

  const m = { top: 30, right: narrow ? 52 : 84, bottom: 30, left: narrow ? 90 : 120 };
  const innerW = Math.max(120, width - m.left - m.right);
  const step = 24;
  const innerH = rows.length * step;
  const hi = max(rows, (r) => Math.max(r.share.late_aircraft, r.share.carrier)) ?? 60;
  const x = scaleLinear().domain([0, Math.max(60, hi * 1.05)]).nice().range([0, innerW]);
  const y = (i: number) => i * step + step / 2;

  return (
    <ChartCard
      title={
        <>
          At {NUMBER_WORDS[lateHeavy.length] ?? lateHeavy.length} airlines, late aircraft causes over half of all delay
          minutes. At {listNames(ownCause.map((r) => shortName(r.name)))}, the airline&rsquo;s own operations are the
          main cause.
        </>
      }
      subtitle={`Share of each airline’s delay minutes caused by late aircraft vs by the airline itself, ${period.range}. Other causes not shown.`}
      legend={
        <Legend
          items={[
            { label: CAUSE_LABEL.late_aircraft, color: CAUSE_COLOR.late_aircraft, shape: "dot" },
            { label: CAUSE_LABEL.carrier, color: CAUSE_COLOR.carrier, shape: "dot" },
          ]}
        />
      }
    >
      <div ref={ref} data-chart="" className="relative">
        <svg {...svgProps} width={width} height={innerH + m.top + m.bottom} role="img" aria-label="Late aircraft versus carrier share of delay minutes by airline">
          <g transform={`translate(${m.left},${m.top})`}>
            <GridX ticks={x.ticks(narrow ? 3 : 6)} x={x} height={innerH} format={pct0} />
            {/* 50% reference: "over half" */}
            <line x1={x(50)} x2={x(50)} y1={-8} y2={innerH} stroke={UI.ink} strokeOpacity={0.5} />
            <text x={x(50)} y={-13} textAnchor="middle" style={{ fill: UI.ink2, fontSize: 11 }}>
              half
            </text>
            <text x={innerW + m.right} y={-13} textAnchor="end" style={{ fill: UI.ink2, fontSize: 11 }}>
              % delayed
            </text>

            {rows.map((r, i) => {
              const s = story(r);
              const faded = s === null;
              const xl = x(r.share.late_aircraft);
              const xc = x(r.share.carrier);
              const yy = y(i);
              return (
                <g
                  key={r.name}
                  {...bind(
                    m.left + Math.max(xl, xc),
                    m.top + yy,
                    <>
                      <TipTitle>{r.name}</TipTitle>
                      <TipRow color={CAUSE_COLOR.late_aircraft} shape="dot" value={pct1(r.share.late_aircraft)} label="late aircraft" />
                      <TipRow color={CAUSE_COLOR.carrier} shape="dot" value={pct1(r.share.carrier)} label="carrier" />
                      <TipRow value={pct1(r.delayRate)} label="of arrivals delayed" />
                    </>,
                  )}
                >
                  <rect x={-m.left} y={yy - step / 2} width={width} height={step} fill="transparent" />
                  <text
                    x={-12}
                    y={yy}
                    dy="0.32em"
                    textAnchor="end"
                    style={{ fill: faded ? UI.ink3 : UI.ink, fontSize: 12, fontWeight: faded ? 400 : 500 }}
                  >
                    {shortName(r.name)}
                  </text>
                  <g opacity={faded ? 0.35 : 1}>
                    <line x1={Math.min(xl, xc)} x2={Math.max(xl, xc)} y1={yy} y2={yy} stroke={UI.stone} strokeWidth={2} />
                    <circle cx={xc} cy={yy} r={5.5} fill={CAUSE_COLOR.carrier} stroke={UI.surface} strokeWidth={2} />
                    <circle cx={xl} cy={yy} r={5.5} fill={CAUSE_COLOR.late_aircraft} stroke={UI.surface} strokeWidth={2} />
                  </g>
                  {/* label only the value the row's story is about */}
                  {s && (
                    <text
                      x={(s === "late" ? xl : xc) + 10}
                      y={yy}
                      dy="0.32em"
                      className="tabular"
                      style={{ fill: UI.ink, fontSize: 11.5, fontWeight: 500 }}
                    >
                      {pct0(s === "late" ? r.share.late_aircraft : r.share.carrier)}
                    </text>
                  )}
                  <text
                    x={innerW + m.right}
                    y={yy}
                    dy="0.32em"
                    textAnchor="end"
                    className="tabular"
                    style={{ fill: faded ? UI.ink3 : UI.ink2, fontSize: 11.5 }}
                  >
                    {pct0(r.delayRate)}
                  </text>
                </g>
              );
            })}
            <line y2={innerH} stroke={UI.baseline} />
          </g>
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </ChartCard>
  );
}
