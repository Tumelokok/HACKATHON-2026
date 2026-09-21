// Top navigation shared across all dashboard pages. Server component,
// no client state. Uses Next.js <Link> so navigation stays client-side.

import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/incidents", label: "Incidents" },
  { href: "/decisions", label: "Decision log" },
  { href: "/actions", label: "Actions" },
  { href: "/replay", label: "Replay" },
] as const;

export function Nav() {
  return (
    <nav className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
          Campus Crisis Agent
        </Link>
        <ul className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-md px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}