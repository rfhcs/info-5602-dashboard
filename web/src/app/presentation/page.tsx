import type { Metadata } from "next";
import { loadDashboardData } from "@/lib/data";
import PopulationMap from "@/components/presentation/population-map";

// Presentation-only slide. Not linked from the dashboard and not indexed.
export const metadata: Metadata = {
  title: "Where Are Flights Delayed?",
  robots: { index: false, follow: false },
};

export default function PresentationPage() {
  const { airports, period } = loadDashboardData();
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-12 md:px-6">
      <p className="mb-2 text-sm text-ink-2">Research question 3, attempt #1</p>
      <h1 className="text-3xl font-medium tracking-tight md:text-4xl">Where are US flights delayed the most?</h1>
      <div className="mt-8">
        <PopulationMap airports={airports} />
      </div>
      <p className="mt-6 text-2xl font-medium tracking-tight">Breaking news: flights get delayed where the people are.</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
        Heat = raw count of delayed arrivals, {period.range}. Compare it with any US population map. Counting delays
        just measures how many people fly, so the real analysis uses rates instead.
      </p>
    </main>
  );
}
