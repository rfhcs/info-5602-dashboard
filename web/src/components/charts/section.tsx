import type { ReactNode } from "react";

export type Stat = { label: string; value: ReactNode; context?: ReactNode };

/**
 * One research question as a dashboard panel: the question, the answer in one
 * sentence, a row of headline numbers, then the charts as evidence.
 */
export function Section({
  id,
  number,
  question,
  answer,
  stats,
  children,
}: {
  id: string;
  number: number;
  question: string;
  answer: ReactNode;
  stats?: Stat[];
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-12 md:py-16">
      <header className="mb-6 w-full">
        <p className="mb-3 flex items-center gap-2 text-base font-medium text-ink-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {number}
          </span>
          {question}
        </p>
        <h2 className="text-lg leading-tight font-medium tracking-tight text-pretty md:text-[28px]">{answer}</h2>
      </header>
      <div className="space-y-6">
        {stats && (
          <dl className="grid gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10">
                <dt className="text-xs text-ink-2">{s.label}</dt>
                <dd className="mt-1 text-3xl font-medium tracking-tight tabular">{s.value}</dd>
                {s.context && <dd className="mt-1 text-xs text-ink-3 text-pretty">{s.context}</dd>}
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </section>
  );
}
