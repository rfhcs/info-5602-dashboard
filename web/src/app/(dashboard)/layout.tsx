import { loadDashboardData } from "@/lib/data";
import { PeriodProvider } from "@/lib/period";
import { SiteNav } from "@/components/site-nav";

// Shared chrome for the overview and the three research-question pages.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { period } = loadDashboardData();

  return (
    <>
      <SiteNav />

      <main className="mx-auto max-w-6xl px-4 md:px-6">
        <PeriodProvider value={period}>{children}</PeriodProvider>
      </main>
    </>
  );
}
