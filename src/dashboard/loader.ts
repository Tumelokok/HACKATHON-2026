// Server-only loader for the dashboard data produced by
// scripts/run_predictions.ts.
//
// This module reads dashboard-data.json from disk. It is not imported
// by client components. The JSON file is generated, not tracked, and
// must be present at runtime. If it is missing, the loader throws a
// clear error rather than silently returning empty data.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  DashboardData,
  DashboardIncident,
  DashboardReport,
} from "./types";

const DEFAULT_PATH = "dashboard-data.json";

let cached: DashboardData | null = null;

function isDashboardReport(value: unknown): value is DashboardReport {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.report_id === "string" &&
    typeof r.incident_id === "string" &&
    typeof r.relationship === "string" &&
    typeof r.severity === "string" &&
    typeof r.processingOrder === "number" &&
    typeof r.human_review === "boolean"
  );
}

function isDashboardIncident(value: unknown): value is DashboardIncident {
  if (typeof value !== "object" || value === null) return false;
  const i = value as Record<string, unknown>;
  return (
    typeof i.incident_id === "string" &&
    typeof i.scene === "string" &&
    typeof i.category === "string" &&
    Array.isArray(i.reportIds)
  );
}

function isDashboardData(value: unknown): value is DashboardData {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  if (!Array.isArray(d.reports) || !Array.isArray(d.incidents)) return false;
  return (
    d.reports.every(isDashboardReport) &&
    d.incidents.every(isDashboardIncident)
  );
}

export function loadDashboardData(path: string = DEFAULT_PATH): DashboardData {
  if (cached && path === DEFAULT_PATH) return cached;

  const absolute = resolve(process.cwd(), path);
  let raw: string;
  try {
    raw = readFileSync(absolute, "utf8");
  } catch {
    throw new Error(
      `Dashboard data not found at ${absolute}. ` +
        `Run: npm run predictions -- --dashboard-output dashboard-data.json`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Dashboard data at ${absolute} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!isDashboardData(parsed)) {
    throw new Error(
      `Dashboard data at ${absolute} does not match the expected shape. ` +
        `Regenerate it by running: npm run predictions -- --dashboard-output dashboard-data.json`,
    );
  }

  if (path === DEFAULT_PATH) cached = parsed;
  return parsed;
}

export function getIncidentById(
  data: DashboardData,
  incidentId: string,
): DashboardIncident | null {
  return (
    data.incidents.find((incident) => incident.incident_id === incidentId) ??
    null
  );
}

export function getReportsForIncident(
  data: DashboardData,
  incidentId: string,
): readonly DashboardReport[] {
  return data.reports
    .filter((report) => report.incident_id === incidentId)
    .sort((a, b) => a.processingOrder - b.processingOrder);
}

export function getReportsInProcessingOrder(
  data: DashboardData,
): readonly DashboardReport[] {
  return [...data.reports].sort((a, b) => a.processingOrder - b.processingOrder);
}