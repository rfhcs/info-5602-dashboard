import { loadDashboardData } from "@/lib/data";
import RQ1Causes from "@/components/sections/rq1-causes";
import RQ2Seasonality from "@/components/sections/rq2-seasonality";
import RQ3Airports from "@/components/sections/rq3-airports";
import { Separator } from "@/components/ui/separator";
import { PeriodProvider } from "@/lib/period";

// Data is read from ../data/processed at build/request time (server only).
export default function Page() {
  const d = loadDashboardData();
  const o = d.overview;

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 text-sm md:px-6">
          <a href="#top" className="font-semibold">
            Why U.S. Flights Are Always Late
          </a>
          <div className="ml-auto flex gap-1 text-ink-2">
            {[
              ["#causes", "1 · Causes"],
              ["#seasons", "2 · Seasons"],
              ["#airports", "3 · Airports"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-2.5 py-1.5 hover:bg-secondary hover:text-foreground">
                {label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <main id="top" className="mx-auto max-w-6xl px-4 md:px-6">
        <header className="pt-12 pb-10 md:pt-16">
          <p className="mb-3 text-sm text-ink-2">
            US domestic flights · {d.period.range}
          </p>
          <h1 className="text-4xl leading-[1.1] font-medium tracking-tight text-pretty md:text-5xl">
            Why U.S. Flights Are Always Late
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-2 text-pretty">
            One in five arrivals lands at least 15 minutes late.
            What causes them, when do they happen, and where?
          </p>

          <dl className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Arrivals delayed ≥15 min" value={`${o.delayRate.toFixed(1)}%`} hero/>
            <Stat label="Arrivals cancelled" value={`${o.cancelRate.toFixed(1)}%`} hero/>
            <Stat label="Arrivals analyzed" value={`${(o.arrivals / 1e6).toFixed(1)}M`} hero/>
          </dl>

          <p className="mt-6 text-xs leading-relaxed text-ink-3 text-pretty">
            Source: Bureau of Transportation Statistics, Airline On-Time Performance (delay cause). One record is one
            airline at one arrival airport in one month. &ldquo;Delayed&rdquo; means arriving 15 or more minutes late;
            cancelled and diverted flights are counted separately.{d.period.partialNote && ` ${d.period.partialNote}`}
          </p>
        </header>

        <PeriodProvider value={d.period}>
        <Separator />
        <RQ1Causes causes={d.causes} carriers={d.carriers} />
        <Separator />
        <RQ2Seasonality months={d.months} monthAvg={d.monthAvg} />
        <Separator />
        <RQ3Airports airports={d.airports} shrinkK={d.shrinkK} nationalDelayRate={d.nationalDelayRate} />
        </PeriodProvider>
      </main>

      <footer className="mt-8 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-ink-3 md:px-6">
          Data: BTS Airline On-Time Performance delay-cause table, {d.period.range} (US domestic carriers only).
          Airport = arrival airport, so a delay counted at SFO may have started elsewhere. Analysis in explore.ipynb.
        </div>
      </footer>
    </>
  );
}

function Stat({ label, value, hero = false }: { label: string; value: string; hero?: boolean }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className={`mt-1 font-medium tracking-tight ${hero ? "text-5xl" : "text-3xl"}`}>{value}</dd>
    </div>
  );
}
