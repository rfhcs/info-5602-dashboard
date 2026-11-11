import type { ReactNode } from "react";

/**
 * Story scaffold for one research question: the question, then the answer in
 * one sentence (the takeaway a reader should leave with), then the evidence.
 */
export function Section({
  id,
  number,
  question,
  answer,
  children,
}: {
  id: string;
  number: number;
  question: string;
  answer: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-12 md:py-16">
      <header className="mb-8 w-full">
        <p className="mb-3 flex items-center gap-2 text-base font-medium text-ink-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {number}
          </span>
          {question}
        </p>
        <h2 className="text-lg leading-tight font-medium tracking-tight text-pretty md:text-[28px]">{answer}</h2>
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** A short connective sentence between charts that carries the story forward. */
export function Bridge({ children }: { children: ReactNode }) {
  return <p className="w-full text-[15px] leading-relaxed text-ink-2 text-pretty">{children}</p>;
}
