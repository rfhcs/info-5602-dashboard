"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Period } from "./data";

/** Makes the data's date coverage available to every chart without prop drilling. */
const PeriodContext = createContext<Period>({ range: "", years: "", partialNote: null });

export function PeriodProvider({ value, children }: { value: Period; children: ReactNode }) {
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export const usePeriod = () => useContext(PeriodContext);
