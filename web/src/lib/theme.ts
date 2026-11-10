// Colour + label tokens for D3. Mirrors the CSS variables in src/app/globals.css.

/**
 * Fixed cause order. Late aircraft sits first so its share always starts at the
 * baseline in stacked bars. This order was run through the colour-vision validator:
 * every neighbouring pair clears ΔE 9 under protan/deutan simulation and ΔE 15
 * for normal vision. (Weather ↔ Security touching fails, so they never sit together.)
 */
export const CAUSES = ["late_aircraft", "carrier", "weather", "nas", "security"] as const;
export type Cause = (typeof CAUSES)[number];

export const CAUSE_COLOR: Record<Cause, string> = {
  late_aircraft: "#e87ba4",
  carrier: "#2a78d6",
  weather: "#eb6834",
  nas: "#1baf7a",
  security: "#605c54",
};

export const CAUSE_LABEL: Record<Cause, string> = {
  late_aircraft: "Late aircraft",
  carrier: "Carrier",
  weather: "Extreme weather",
  nas: "NAS (air traffic & airport)",
  security: "Security",
};

export const CAUSE_SHORT: Record<Cause, string> = {
  late_aircraft: "Late aircraft",
  carrier: "Carrier",
  weather: "Weather",
  nas: "NAS",
  security: "Security",
};

/** Brand palette + chart chrome. */
export const UI = {
  primary: "#184f95", // navy — single-series marks, "better than expected"
  tertiary: "#e34948", // coral red — spotlight, "worse than expected", events
  stone: "#c3c2b7", // de-emphasised / context marks
  stoneLight: "#dcdbd3", // faint context lines (per-year traces)
  surface: "#fcfcfb",
  ink: "#0b0b0b",
  ink2: "#52514e",
  ink3: "#6b6a65", // axis tick text (5.3:1 on the surface)
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
} as const;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
