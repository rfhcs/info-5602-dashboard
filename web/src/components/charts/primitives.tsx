"use client";

/**
 * Small building blocks shared by every chart. D3 does the maths (scales, shapes,
 * ticks); React renders the SVG so each chart reads top-to-bottom as markup.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { UI } from "@/lib/theme";

/* ------------------------------------------------------------ sizing --- */

/**
 * Tracks the rendered width of a container so charts can be responsive.
 * Uses a callback ref so it re-attaches if the container is unmounted and
 * mounted again, and ignores 0-width readings from hidden containers.
 */
export function useWidth<T extends HTMLElement = HTMLDivElement>(initial = 720) {
  const [width, setWidth] = useState(initial);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    observer.current = ro;
  }, []);
  return [ref, width] as const;
}

/* ----------------------------------------------------------- tooltip --- */

type Tip = { x: number; y: number; content: ReactNode } | null;

/**
 * Tooltip state. Tooltips anchor to the mark (not the cursor) so the same
 * readout appears on keyboard focus as on hover.
 */
export function useTooltip() {
  const [tip, setTip] = useState<Tip>(null);
  /** Spread onto any SVG mark: hover + keyboard focus both show the tooltip. */
  const bind = (x: number, y: number, content: ReactNode) => ({
    tabIndex: 0,
    onPointerEnter: () => setTip({ x, y, content }),
    onPointerLeave: () => setTip(null),
    onFocus: () => setTip({ x, y, content }),
    onBlur: () => setTip(null),
    style: { outline: "none", cursor: "default" } as const,
  });
  return { tip, setTip, bind };
}

export function ChartTooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width - 220;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 min-w-36 max-w-64 rounded-md bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10"
      style={{
        left: flip ? undefined : tip.x + 14,
        right: flip ? width - tip.x + 14 : undefined,
        top: tip.y,
        transform: "translateY(-50%)",
      }}
    >
      {tip.content}
    </div>
  );
}

/** One tooltip line: the value leads (strong), the label follows (secondary). */
export function TipRow({ color, value, label, shape = "line" }: { color?: string; value: ReactNode; label: ReactNode; shape?: "line" | "dot" }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color &&
        (shape === "line" ? (
          <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
        ) : (
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        ))}
      <span className="font-medium tabular text-foreground">{value}</span>
      <span className="text-ink-2">{label}</span>
    </div>
  );
}

export function TipTitle({ children }: { children: ReactNode }) {
  return <div className="mb-1 font-medium text-foreground">{children}</div>;
}

/* ------------------------------------------------------------ legend --- */

export type LegendItem = { label: string; color: string; shape?: "rect" | "line" | "dot" };

export function Legend({ items, className = "" }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 ${className}`}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.shape === "line" ? (
            <span className="h-0.5 w-4 rounded-full" style={{ background: it.color }} />
          ) : it.shape === "dot" ? (
            <span className="size-2.5 rounded-full" style={{ background: it.color }} />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- axes --- */

const tickText = { fill: UI.ink3, fontSize: 11 } as const;

/** Horizontal gridlines + left tick labels for a y scale. */
export function GridY({
  ticks,
  y,
  width,
  format,
  label,
}: {
  ticks: number[];
  y: (v: number) => number;
  width: number;
  format: (v: number) => string;
  label?: string;
}) {
  return (
    <g className="tabular">
      {ticks.map((t) => (
        <g key={t} transform={`translate(0,${y(t)})`}>
          <line x2={width} stroke={UI.grid} strokeWidth={1} />
          <text x={-8} dy="0.32em" textAnchor="end" style={tickText}>
            {format(t)}
          </text>
        </g>
      ))}
      {label && (
        <text x={-8} y={-12} textAnchor="start" style={{ ...tickText, fill: UI.ink2 }} transform="translate(0,0)">
          {label}
        </text>
      )}
    </g>
  );
}

/** Vertical gridlines + bottom tick labels for an x scale. */
export function GridX({
  ticks,
  x,
  height,
  format,
  label,
  width,
}: {
  ticks: number[];
  x: (v: number) => number;
  height: number;
  format: (v: number) => string;
  label?: string;
  width?: number;
}) {
  return (
    <g className="tabular">
      {ticks.map((t) => (
        <g key={t} transform={`translate(${x(t)},0)`}>
          <line y1={0} y2={height} stroke={UI.grid} strokeWidth={1} />
          <text y={height + 16} textAnchor="middle" style={tickText}>
            {format(t)}
          </text>
        </g>
      ))}
      {label && (
        <text x={width ?? 0} y={height + 34} textAnchor="end" style={{ ...tickText, fill: UI.ink2 }}>
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * Horizontal bar with a 4px rounded data-end and a square baseline end.
 * x0 is the baseline; x1 the value end (may be left of x0 for negatives).
 */
export function barPath(x0: number, x1: number, y: number, h: number, r = 4) {
  const w = Math.abs(x1 - x0);
  const rr = Math.min(r, w, h / 2);
  if (x1 >= x0) {
    return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`;
  }
  return `M${x0},${y}H${x1 + rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 + rr},${y + h}H${x0}Z`;
}

/** Vertical column with a rounded top and square baseline. */
export function columnPath(x: number, w: number, y0: number, y1: number, r = 4) {
  const h = Math.abs(y0 - y1);
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
}

/** Footnote marker inside SVG text. */
export function SvgSup({ children }: { children: ReactNode }) {
  return (
    <tspan dy="-0.45em" fontSize="0.75em">
      {children}
    </tspan>
  );
}
