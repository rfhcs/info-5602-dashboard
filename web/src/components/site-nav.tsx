"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The dashboard's pages in story order: overview, then one page per research question. */
export const PAGES = [
  { href: "/", label: "Overview" },
  { href: "/causes", label: "1 · Causes" },
  { href: "/seasons", label: "2 · Seasons" },
  { href: "/airports", label: "3 · Airports" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 text-sm md:px-6">
        <Link href="/" className="hidden font-semibold sm:block">
          Why U.S. Flights Are Always Late
        </Link>
        <div className="flex gap-1 text-ink-2 sm:ml-auto">
          {PAGES.slice(1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className="rounded-md px-2.5 py-1.5 hover:bg-secondary hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

/** Previous / next links at the foot of each page, so the story reads in order. */
// export function PageSteps() {
//   const pathname = usePathname();
//   const i = PAGES.findIndex((p) => p.href === pathname);
//   if (i < 0) return null;
//   const prev = PAGES[i - 1];
//   const next = PAGES[i + 1];
//   return (
//     <div className="flex items-center justify-between gap-4 border-t border-border py-8 text-sm">
//       {prev ? (
//         <Link href={prev.href} className="text-ink-2 hover:text-foreground">
//           ← {prev.label}
//         </Link>
//       ) : (
//         <span />
//       )}
//       {next && (
//         <Link href={next.href} className="rounded-md bg-primary px-3.5 py-2 font-medium text-primary-foreground hover:bg-primary/90">
//           Next: {next.label} →
//         </Link>
//       )}
//     </div>
//   );
// }
