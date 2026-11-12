import Link from "next/link";
import { loadDashboardData } from "@/lib/data";

const QUESTIONS = [
  { href: "/causes", number: 1, question: "What is the biggest cause of flight delays?" },
  { href: "/seasons", number: 2, question: "Which time of year is busiest, and does busy mean delayed?" },
  { href: "/airports", number: 3, question: "Which airports experience the most delays?" },
];

// Data is read from ../data/processed at build/request time (server only).
export default function Page() {
  const d = loadDashboardData();
  const o = d.overview;

  return (
    <header className="pt-12 pb-12 md:pt-16">
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
        <Stat label="Arrivals delayed ≥15 min" value={`${o.delayRate.toFixed(1)}%`} />
        <Stat label="Arrivals cancelled" value={`${o.cancelRate.toFixed(1)}%`} />
        <Stat label="Arrivals analyzed" value={`${(o.arrivals / 1e6).toFixed(1)}M`} />
      </dl>

      <nav className="mt-10 grid gap-3 md:grid-cols-3" aria-label="Research questions">
        {QUESTIONS.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group flex flex-col gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10 transition-shadow hover:ring-primary/60"
          >
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {q.number}
            </span>
            <span className="text-lg leading-snug font-medium tracking-tight text-pretty">{q.question}</span>
            <span className="mt-auto text-sm text-primary">
              Explore <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </nav>

      <p className="mt-6 text-xs leading-relaxed text-ink-3 text-pretty">
        Source: Bureau of Transportation Statistics, Airline On-Time Performance (delay cause). One record is one
        airline at one arrival airport in one month. &ldquo;Delayed&rdquo; means arriving 15 or more minutes late;
        cancelled and diverted flights are counted separately.{d.period.partialNote && ` ${d.period.partialNote}`}
      </p>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-1 text-5xl font-medium tracking-tight">{value}</dd>
    </div>
  );
}
