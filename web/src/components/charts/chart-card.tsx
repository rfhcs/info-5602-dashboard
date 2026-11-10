import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type Footnote = { mark: string; text: ReactNode };

/** A chart in a shadcn Card: optional fix tag, title, subtitle, legend, chart, footnotes. */
export function ChartCard({
  title,
  subtitle,
  tag,
  legend,
  children,
  footnotes,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  tag?: string;
  legend?: ReactNode;
  children: ReactNode;
  footnotes?: Footnote[];
  className?: string;
}) {
  return (
    <Card className={`gap-3 py-5 ${className}`}>
      <CardHeader className="px-5">
        <div className="space-y-1">
          {tag && (
            <Badge variant="secondary" className="mb-1 font-normal text-ink-2">
              {tag}
            </Badge>
          )}
          <CardTitle className="text-[15px] leading-snug font-medium text-pretty">{title}</CardTitle>
          {subtitle && <CardDescription className="text-[13px] text-ink-2 text-pretty">{subtitle}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="px-5">
        {legend && <div className="mb-3">{legend}</div>}
        {children}
        {footnotes && footnotes.length > 0 && <Footnotes items={footnotes} />}
      </CardContent>
    </Card>
  );
}

/** Quiet numbered notes under a chart: small, muted, out of the way of the data. */
export function Footnotes({ items }: { items: Footnote[] }) {
  return (
    <ol className="mt-4 space-y-1 border-t border-border pt-3 text-xs leading-relaxed text-ink-3">
      {items.map((f) => (
        <li key={f.mark || "note"} className="flex gap-1.5">
          {f.mark && <sup className="mt-1.5 shrink-0 font-medium text-ink-2">{f.mark}</sup>}
          <span className="text-pretty">{f.text}</span>
        </li>
      ))}
    </ol>
  );
}
