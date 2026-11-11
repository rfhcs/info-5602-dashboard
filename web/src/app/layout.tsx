import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { loadDashboardData } from "@/lib/data";
import "./globals.css";

// One typeface for the whole dashboard (headings, body, numbers, chart text).
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export function generateMetadata(): Metadata {
  const { period } = loadDashboardData();
  return {
    title: "Why Flying is So Painful",
    description: `What causes US flight delays, when they happen, and where — BTS on-time data, ${period.range}.`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} antialiased`}>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
