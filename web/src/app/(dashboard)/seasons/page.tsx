import type { Metadata } from "next";
import { loadDashboardData } from "@/lib/data";
import RQ2Seasonality from "@/components/sections/rq2-seasonality";

export const metadata: Metadata = { title: "Seasons · Why U.S. Flights Are Always Late" };

export default function SeasonsPage() {
  const d = loadDashboardData();
  return <RQ2Seasonality months={d.months} monthAvg={d.monthAvg} />;
}
