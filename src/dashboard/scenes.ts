// Pure helpers for filtering and aggregating dashboard data by judge scene.
// No I/O. No side effects. Safe to import from both server and client
// components.

import type {
  DashboardData,
  DashboardIncident,
  SceneName,
} from "./types";

export const SCENE_ORDER: readonly SceneName[] = [
  "NETWORK_OUTAGE",
  "SMOKE_ELECTRICAL",
  "CONTRACTOR_VERIFICATION",
  "LIFT_ACCESSIBILITY",
  "OTHER",
] as const;

const SCENE_LABELS: Readonly<Record<SceneName, string>> = {
  NETWORK_OUTAGE: "Network outage",
  SMOKE_ELECTRICAL: "Smoke / electrical",
  CONTRACTOR_VERIFICATION: "Contractor verification",
  LIFT_ACCESSIBILITY: "Lift / accessibility",
  OTHER: "Other",
};

const SCENE_DESCRIPTIONS: Readonly<Record<SceneName, string>> = {
  NETWORK_OUTAGE:
    "Campus-wide network outage, ICT coordination, and recovery monitoring.",
  SMOKE_ELECTRICAL:
    "Fire, smoke, and electrical incidents with conflicting evidence and safety escalation.",
  CONTRACTOR_VERIFICATION:
    "Unverified contractor access and security escalation when identity is uncertain.",
  LIFT_ACCESSIBILITY:
    "Lift failure, accessibility impact, maintenance dispatch, and reopening.",
  OTHER:
    "Reports that did not map to one of the four judge scenes.",
};

export function sceneLabel(scene: SceneName): string {
  return SCENE_LABELS[scene];
}

export function sceneDescription(scene: SceneName): string {
  return SCENE_DESCRIPTIONS[scene];
}

export function incidentsForScene(
  data: DashboardData,
  scene: SceneName,
): readonly DashboardIncident[] {
  return data.incidents
    .filter((incident) => incident.scene === scene)
    .sort((a, b) => a.firstProcessingOrder - b.firstProcessingOrder);
}

export function sceneCounts(
  data: DashboardData,
): Readonly<Record<SceneName, number>> {
  const counts: Record<SceneName, number> = {
    NETWORK_OUTAGE: 0,
    SMOKE_ELECTRICAL: 0,
    CONTRACTOR_VERIFICATION: 0,
    LIFT_ACCESSIBILITY: 0,
    OTHER: 0,
  };
  for (const incident of data.incidents) {
    counts[incident.scene] += 1;
  }
  return counts;
}

export interface SummaryCounts {
  incidents: number;
  reports: number;
  conflicts: number;
  humanReviews: number;
}

export function summaryCounts(data: DashboardData): SummaryCounts {
  let conflicts = 0;
  let humanReviews = 0;
  for (const report of data.reports) {
    if (report.conflicts.conflictExists) conflicts += 1;
    if (report.human_review) humanReviews += 1;
  }
  return {
    incidents: data.incidents.length,
    reports: data.reports.length,
    conflicts,
    humanReviews,
  };
}

export function severityTone(
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

export function relationshipTone(
  relationship: string,
): "new" | "update" | "corroboration" | "conflict" | "duplicate" | "resolution" {
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