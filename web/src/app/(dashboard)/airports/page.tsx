import type { Metadata } from "next";
import { loadDashboardData } from "@/lib/data";
import RQ3Airports from "@/components/sections/rq3-airports";

export const metadata: Metadata = { title: "Airports · Why U.S. Flights Are Always Late" };

export default function AirportsPage() {
  const d = loadDashboardData();
  return <RQ3Airports airports={d.airports} shrinkK={d.shrinkK} nationalDelayRate={d.nationalDelayRate} />;
}
