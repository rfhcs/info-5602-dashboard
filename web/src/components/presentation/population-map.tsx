"use client";

/**
 * The joke chart (presentation only — not part of the dashboard).
 * A heat map of RAW delayed-flight counts. It looks exactly like a US
 * population map, which is the point: counts measure where people fly from.
 */

import { contourDensity, geoAlbersUsa, geoPath, max, scaleLinear } from "d3";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import us from "us-atlas/states-10m.json";
import type { Airport } from "@/lib/data";
import { UI } from "@/lib/theme";
import { useWidth } from "@/components/charts/primitives";

const topo = us as unknown as Topology<{ states: GeometryCollection; nation: GeometryCollection }>;
const states = feature(topo, topo.objects.states);
const borders = mesh(topo, topo.objects.states, (a, b) => a !== b);
const nation = feature(topo, topo.objects.nation);

export default function PopulationMap({ airports }: { airports: Airport[] }) {
  const [ref, width] = useWidth(960);
  const height = Math.round(width * 0.62);
  const projection = geoAlbersUsa().fitSize([width, height], states);
  const path = geoPath(projection);

  const pts = airports
    .filter((a) => a.lat != null && a.lon != null)
    .map((a) => ({ a, p: projection([a.lon!, a.lat!]) }))
    .filter((d): d is { a: Airport; p: [number, number] } => d.p != null);

  const density = contourDensity<(typeof pts)[number]>()
    .x((d) => d.p[0])
    .y((d) => d.p[1])
    .weight((d) => d.a.delayed)
    .size([width, height])
    .bandwidth(Math.max(10, width / 55))
    .thresholds(16)(pts);

  const top = max(density, (c) => c.value) ?? 1;
  const opacity = scaleLinear().domain([0, top]).range([0.06, 0.95]);

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label="Heat map of delayed flights across the US">
        <defs>
          <clipPath id="us-clip">
            <path d={path(nation) ?? ""} />
          </clipPath>
        </defs>
        <path d={path(nation) ?? ""} fill="#f0efec" />
        <g clipPath="url(#us-clip)">
          {density.map((c, i) => (
            <path key={i} d={geoPath()(c) ?? ""} fill={UI.tertiary} fillOpacity={opacity(c.value)} />
          ))}
        </g>
        <path d={path(borders) ?? ""} fill="none" stroke="#ffffff" strokeWidth={0.8} />
      </svg>
    </div>
  );
}
