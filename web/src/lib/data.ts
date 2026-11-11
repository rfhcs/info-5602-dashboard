import "server-only";
import fs from "node:fs";
import path from "node:path";
import { csvParse } from "d3";
import { CAUSES, type Cause } from "./theme";

/**
 * Reads the tidy CSVs written by the last cell of explore.ipynb (data/processed/).
 * Re-run the notebook and refresh the page to pick up changes.
 */
const DATA_DIR = path.join(process.cwd(), "..", "data");

function readCsv(file: string) {
  return csvParse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}
const num = (v: string | undefined) => (v === undefined || v === "" ? NaN : +v);
const byCause = <T>(fn: (c: Cause) => T) =>
  Object.fromEntries(CAUSES.map((c) => [c, fn(c)])) as Record<Cause, T>;

/* ----------------------------------------------------------------- RQ1 --- */

export type CauseTotal = {
  cause: Cause;
  flights: number; // delayed flights attributed to the cause
  minutes: number;
  shareFlights: number; // %
  shareMinutes: number; // %
  avgMinPerDelay: number;
  rootShare: number | null; // % of minutes once late aircraft is redistributed
};

export type Carrier = {
  name: string;
  flights: number;
  delayRate: number; // %
  share: Record<Cause, number>; // % of the carrier's delay minutes
};

/* ----------------------------------------------------------------- RQ2 --- */

export type MonthRow = {
  year: number;
  month: number; // 1–12
  flights: number;
  flightsPerDay: number;
  delayRate: number; // %
  cancelRate: number; // %
  volumeVsYearAvg: number; // % above/below that year's average flights/day
  mpf: Record<Cause, number>; // delay minutes per scheduled flight
};

export type MonthAvg = Omit<MonthRow, "year" | "flights" | "volumeVsYearAvg">;

/* ----------------------------------------------------------------- RQ3 --- */

export type Airport = {
  code: string;
  city: string;
  flights: number;
  delayed: number;
  expDelayed: number; // delays expected if each airline performed at its national rate that month
  delayRate: number; // %
  excessPp: number; // percentage points above (+) / below (−) the airline-mix expectation
  cancelRate: number; // %
  mpf: Record<Cause, number>; // delay minutes per arrival
  share: Record<Cause, number>; // % of the airport's delay minutes
  sizeRank: number;
  lat: number | null;
  lon: number | null;
  note?: string;
};

/** The data's date coverage, worked out from the CSVs so every label stays current. */
export type Period = {
  range: string; // "Jan 2023 – Aug 2026"
  years: string; // "2023–2026"
  partialNote: string | null; // "2026 covers January to August." when the last year is incomplete
};

export type DashboardData = {
  overview: { arrivals: number; delayed: number; delayRate: number; cancelRate: number; start: string; end: string };
  period: Period;
  causes: CauseTotal[];
  carriers: Carrier[];
  months: MonthRow[];
  monthAvg: MonthAvg[];
  airports: Airport[];
  shrinkK: number; // empirical-Bayes prior strength, in arrivals
  nationalDelayRate: number; // %
};

export function loadDashboardData(): DashboardData {
  /* causes */
  const causes: CauseTotal[] = readCsv("processed/causes_overall.csv").map((r) => ({
    cause: r.cause as Cause,
    flights: num(r.flights),
    minutes: num(r.minutes),
    shareFlights: num(r.share_flights),
    shareMinutes: num(r.share_minutes),
    avgMinPerDelay: num(r.avg_min_per_delay),
    rootShare: Number.isNaN(num(r.root_share)) ? null : num(r.root_share),
  }));

  /* carriers */
  const carriers: Carrier[] = readCsv("processed/carriers.csv").map((r) => ({
    name: r.carrier_name!,
    flights: num(r.arr_flights),
    delayRate: num(r.delay_rate),
    share: byCause((c) => num(r[`${c}_share`])),
  }));

  /* months */
  const months: MonthRow[] = readCsv("processed/monthly.csv").map((r) => ({
    year: num(r.year),
    month: num(r.month),
    flights: num(r.arr_flights),
    flightsPerDay: num(r.flights_per_day),
    delayRate: num(r.delay_rate),
    cancelRate: num(r.cancel_rate),
    volumeVsYearAvg: num(r.volume_vs_year_avg),
    mpf: byCause((c) => num(r[`${c}_mpf`])),
  }));
  // Average each calendar month across years (2026 only covers Jan–Aug, so summing would bias).
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const monthAvg: MonthAvg[] = Array.from({ length: 12 }, (_, i) => {
    const rows = months.filter((m) => m.month === i + 1);
    return {
      month: i + 1,
      flightsPerDay: mean(rows.map((r) => r.flightsPerDay)),
      delayRate: mean(rows.map((r) => r.delayRate)),
      cancelRate: mean(rows.map((r) => r.cancelRate)),
      mpf: byCause((c) => mean(rows.map((r) => r.mpf[c]))),
    };
  });

  const arrivals = months.reduce((a, m) => a + m.flights, 0);
  const delayedTotal = months.reduce((a, m) => a + (m.delayRate / 100) * m.flights, 0);
  const cancelledTotal = months.reduce((a, m) => a + (m.cancelRate / 100) * m.flights, 0);
  const first = months.reduce((a, m) => (m.year * 12 + m.month < a.year * 12 + a.month ? m : a));
  const last = months.reduce((a, m) => (m.year * 12 + m.month > a.year * 12 + a.month ? m : a));
  const label = (m: MonthRow) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;

  /* airports */
  const coords = new Map(readCsv("airport_coords.csv").map((r) => [r.airport!, [num(r.lat), num(r.lon)] as const]));
  type Raw = Record<string, number> & { code: string; city: string };
  const COUNT_COLS = ["flights", "delayed", "exp_del", "cancelled", "minutes", ...CAUSES.map((c) => `${c}_delay`)];
  const raw = new Map<string, Raw>();
  for (const r of readCsv("processed/airports.csv")) {
    const row = { code: r.airport!, city: r.city! } as Raw;
    for (const col of COUNT_COLS) row[col] = num(r[col]);
    raw.set(row.code, row);
  }
  // Palm Beach International was renamed (PBI → DJT) in Aug 2026; BTS reports the
  // last month under the new code. Fold it back so the airport isn't split in two.
  const notes: Record<string, string> = {};
  const pbi = raw.get("PBI");
  const djt = raw.get("DJT");
  if (pbi && djt) {
    for (const col of COUNT_COLS) pbi[col] += djt[col];
    raw.delete("DJT");
    notes.PBI = "Includes Aug 2026, reported under the airport's new code DJT.";
  }

  const rows = [...raw.values()];
  const totFlights = rows.reduce((a, r) => a + r.flights, 0);
  const totDelayed = rows.reduce((a, r) => a + r.delayed, 0);
  const p = totDelayed / totFlights;

  const airports: Airport[] = rows
    .sort((a, b) => b.flights - a.flights)
    .map((r, i) => {
      const c = coords.get(r.code);
      return {
        code: r.code,
        city: r.city,
        flights: r.flights,
        delayed: r.delayed,
        expDelayed: r.exp_del,
        delayRate: (r.delayed / r.flights) * 100,
        excessPp: ((r.delayed - r.exp_del) / r.flights) * 100,
        cancelRate: (r.cancelled / r.flights) * 100,
        mpf: byCause((k) => r[`${k}_delay`] / r.flights),
        share: byCause((k) => (r[`${k}_delay`] / r.minutes) * 100),
        sizeRank: i + 1,
        lat: c ? c[0] : null,
        lon: c ? c[1] : null,
        note: notes[r.code],
      };
    });

  return {
    overview: {
      arrivals,
      delayed: delayedTotal,
      delayRate: (delayedTotal / arrivals) * 100,
      cancelRate: (cancelledTotal / arrivals) * 100,
      start: label(first),
      end: label(last),
    },
    period: {
      range: `${label(first)} – ${label(last)}`,
      years: first.year === last.year ? String(first.year) : `${first.year}–${last.year}`,
      partialNote: last.month < 12 ? `${last.year} covers January to ${FULL_MONTHS[last.month - 1]}.` : null,
    },
    causes,
    carriers,
    months,
    monthAvg,
    airports,
    shrinkK: estimateShrinkage(airports, p),
    nationalDelayRate: p * 100,
  };
}

/**
 * Empirical-Bayes shrinkage strength k (in arrivals).
 * Across airports, (rate − p)² ≈ τ² + σ²/n: τ² is the real spread between airports,
 * σ²/n the noise from having only n arrivals. Fitting that line by least squares
 * gives k = σ²/τ², and each airport's shrunk rate is (delayed + k·p) / (n + k).
 */
function estimateShrinkage(airports: Airport[], p: number) {
  const xs = airports.map((a) => 1 / a.flights);
  const ys = airports.map((a) => (a.delayRate / 100 - p) ** 2);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const sigma2 = sxy / sxx;
  const tau2 = my - sigma2 * mx;
  return tau2 > 0 && sigma2 > 0 ? sigma2 / tau2 : 0;
}

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
