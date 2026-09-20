// Small inline badge used to render severity, status, and relationship
// labels consistently across the dashboard.

import type { ReactNode } from "react";

export type BadgeTone =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "new"
  | "update"
  | "corroboration"
  | "conflict"
  | "duplicate"
  | "resolution"
  | "investigating"
  | "active"
  | "escalated"
  | "controlled"
  | "resolved"
  | "neutral";

const TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  new: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  update:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  corroboration:
    "bg-slate-100 text-slate-800 dark:bg-slate-700/60 dark:text-slate-200",
  conflict: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  duplicate:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
  resolution:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  investigating:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  active: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  escalated: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  controlled:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  resolved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  neutral:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function severityToneFromString(
  severity: string,
): "low" | "medium" | "high" | "critical" {
  switch (severity) {
    case "LOW":
      return "low";
    case "MEDIUM":
      return "medium";
    case "HIGH":
      return "high";
    case "CRITICAL":
      return "critical";
    default:
      return "low";
  }
}

export function statusToneFromString(
  status: string,
):
  | "investigating"
  | "active"
  | "escalated"
  | "controlled"
  | "resolved" {
  switch (status) {
    case "INVESTIGATING":
      return "investigating";
    case "ACTIVE":
      return "active";
    case "ESCALATED":
      return "escalated";
    case "CONTROLLED":
      return "controlled";
    case "RESOLVED":
      return "resolved";
    default:
      return "investigating";
  }
}

export function relationshipToneFromString(
  relationship: string,
):
  | "new"
  | "update"
  | "corroboration"
  | "conflict"
  | "duplicate"
  | "resolution" {
  switch (relationship) {
    case "NEW":
      return "new";
    case "UPDATE":
      return "update";
    case "CORROBORATION":
      return "corroboration";
    case "CONFLICT":
      return "conflict";
    case "DUPLICATE":
      return "duplicate";
    case "RESOLUTION":
      return "resolution";
    default:
      return "new";
  }
}