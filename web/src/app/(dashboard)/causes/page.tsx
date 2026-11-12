import type { Metadata } from "next";
import { loadDashboardData } from "@/lib/data";
import RQ1Causes from "@/components/sections/rq1-causes";

export const metadata: Metadata = { title: "Causes · Why U.S. Flights Are Always Late" };

export default function CausesPage() {
  const d = loadDashboardData();
  return <RQ1Causes causes={d.causes} carriers={d.carriers} />;
}
