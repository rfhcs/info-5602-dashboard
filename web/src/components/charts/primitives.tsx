"use client";

/**
 * Small building blocks shared by every chart. D3 does the maths (scales, shapes,
 * ticks); React renders the SVG so each chart reads top-to-bottom as markup.
 */

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { UI } from "@/lib/theme";

/* ------------------------------------------------------------ sizing --- */

/**
 * Tracks the rendered width of a container so charts can be responsive.
 *
 * Put `data-chart=""` on the container: globals.css hides it until it has been
 * measured, so the server-rendered guess (`initial`) never flashes on screen.
 * The callback ref measures synchronously on mount (React flushes that update
 * before paint), re-attaches if the container remounts, and ignores 0-width
 * readings from hidden containers.
 */
export function useWidth<T extends HTMLElement = HTMLDivElement>(initial = 720) {
  const [width, setWidth] = useState(initial);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const w0 = Math.floor(el.getBoundingClientRect().width);
    if (w0 > 0) setWidth(w0);
    el.setAttribute("data-measured", "");
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

type Point = { x: number; y: number; content: ReactNode };

/**
 * Tooltip state for one chart.
 *
 * - `bind(x, y, content)` goes on each mark: hovering it shows the tooltip.
 * - `svgProps` goes on the chart's <svg>: the whole chart is ONE tab stop, and
 *   the arrow keys step through its marks (Home/End jump, Esc hides). Marks are
 *   visited in render order, or left-to-right with `{ order: "x" }` (scatters).
 */
export function useTooltip({ order = "render" }: { order?: "render" | "x" } = {}) {
  const [tip, setTip] = useState<Tip>(null);
  const [active, setActive] = useState(-1);
  // Collected fresh on every render as marks call bind(); handlers read this render's list.
  const points: Point[] = [];

  const bind = (x: number, y: number, content: ReactNode) => {
    points.push({ x, y, content });
    return {
      onPointerEnter: () => setTip({ x, y, content }),
      onPointerLeave: () => setTip(null),
      style: { cursor: "default" } as const,
    };
  };

  const ordered = () => (order === "x" ? [...points].sort((a, b) => a.x - b.x || a.y - b.y) : points);
  const show = (i: number) => {
    const list = ordered();
    if (!list.length) return;
    const k = Math.max(0, Math.min(list.length - 1, i));
    setActive(k);
    setTip(list[k]);
  };

  const svgProps = {
    tabIndex: 0,
    className: "rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
    onFocus: () => show(active < 0 ? 0 : active),
    onBlur: () => setTip(null),
    onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
      const n = ordered().length;
      const keys: Record<string, number> = {
        ArrowRight: active + 1,
        ArrowDown: active + 1,
        ArrowLeft: active - 1,
        ArrowUp: active - 1,
        Home: 0,
        End: n - 1,
      };
      if (e.key in keys) {
        e.preventDefault();
        show(keys[e.key]);
      } else if (e.key === "Escape") {
        setTip(null);
      }
    },
  };

  return { tip, setTip, bind, svgProps };
}

/**
 * Renders the tooltip into document.body so no card or panel edge can clip it.
 * `tip.x / tip.y` are relative to the nearest `relative` container; the anchor
 * div finds that container's position on the page. The tooltip sits right of
 * the point, flips left if it would leave the viewport, and is clamped so it
 * never runs off either side or under the sticky nav.
 */
const NAV_HEIGHT = 56;

export function ChartTooltip({ tip }: { tip: Tip; width?: number }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const el = tipRef.current;
    if (!tip || !anchor || !el) return;
    const a = anchor.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    // prefer staying inside the card the chart lives in; fall back to the viewport
    const card = anchor.closest("[data-slot=card]")?.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const gap = 14;
    const pad = 8;
    const px = a.left + tip.x;
    const py = a.top + tip.y;
    const rightEdge = Math.min(vw - pad, card ? card.right - pad : vw - pad);
    let left = px + gap;
    if (left + t.width > rightEdge && px - gap - t.width >= pad) left = px - gap - t.width;
    left = Math.max(pad, Math.min(left, vw - pad - t.width));
    let top = py - t.height / 2;
    top = Math.max(NAV_HEIGHT + pad, Math.min(top, vh - pad - t.height));
    el.style.left = `${left + window.scrollX}px`;
    el.style.top = `${top + window.scrollY}px`;
    el.style.visibility = "visible";
  }, [tip]);

  return (
    <>
      <div ref={anchorRef} aria-hidden className="pointer-events-none absolute top-0 left-0 size-0" />
      {tip &&
        createPortal(
          <div
            ref={tipRef}
            role="status"
            className="pointer-events-none absolute z-50 min-w-36 max-w-64 rounded-md bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10"
            style={{ left: 0, top: 0, visibility: "hidden" }}
          >
            {tip.content}
          </div>,
          document.body,
        )}
    </>
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
