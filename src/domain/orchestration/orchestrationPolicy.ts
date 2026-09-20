import type { NormalizedReport } from "@/types/report";
import type { IncidentState } from "@/domain/lifecycle";
import type { SeverityLevel } from "@/domain/severity";
import type { LifecycleIntent } from "./types";

function hasAny(reports: readonly NormalizedReport[], terms: readonly string[]): boolean {
  return reports.some((report) => {
    const text = report.descriptionRaw.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

function hasResolutionEvidence(reports: readonly NormalizedReport[]): boolean {
  return hasAny(reports, ["repaired and tested", "repair completed", "restored and tested", "hazard removed", "incident confirmed resolved", "fire extinguished"]);
}

export function isSerious(severity: SeverityLevel | null): boolean {
  return severity === "HIGH" || severity === "CRITICAL";
}

export function recommendedLifecycleIntent(
  state: IncidentState,
  severity: SeverityLevel | null,
  reports: readonly NormalizedReport[],
  conflictRequiresReview: boolean,
): LifecycleIntent | null {
  if (state === "CREATED") return "ASSESS";
  if (state === "RESOLVED" && (isSerious(severity) || hasAny(reports, ["trapped again", "immediate danger"]))) return "REOPEN";
  if (
    (state === "ASSESSING" || state === "MONITORING") &&
    conflictRequiresReview &&
    !hasResolutionEvidence(reports)
  ) {
    return "ESCALATE";
  }
  if (state === "ASSESSING" && isSerious(severity)) return "ACTIVATE";
  if (state === "ACTIVE" && isSerious(severity)) return "RESPOND";
  if (state === "RESPONDING" && (hasAny(reports, ["power isolated", "technician is monitoring", "response is complete"]) || hasResolutionEvidence(reports))) return "MONITOR";
  if (state === "MONITORING" && hasResolutionEvidence(reports)) return "RESOLVE";
  if (state === "MONITORING" && isSerious(severity)) return "ACTIVATE";
  if (state === "ESCALATED" && hasResolutionEvidence(reports)) return "MONITOR";
  if (state === "ESCALATED" && !conflictRequiresReview && isSerious(severity)) {
    return "RESPOND";
  }
  return null;
}

export function hasCredibleResolutionEvidence(reports: readonly NormalizedReport[]): boolean {
  return hasResolutionEvidence(reports);
}