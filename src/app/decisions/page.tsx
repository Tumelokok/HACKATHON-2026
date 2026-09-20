import Link from "next/link";
import { Nav } from "../components/Nav";
import {
  Badge,
  severityToneFromString,
  statusToneFromString,
  relationshipToneFromString,
} from "../components/Badge";
import { loadDashboardData } from "@/dashboard/loader";
import { SCENE_ORDER, sceneLabel } from "@/dashboard/scenes";
import type {
  DashboardReport,
  SceneName,
} from "@/dashboard/types";
import type { PredictedRelationship } from "@/output/types";

export const dynamic = "force-dynamic";

const RELATIONSHIP_ORDER: readonly PredictedRelationship[] = [
  "NEW",
  "UPDATE",
  "CORROBORATION",
  "CONFLICT",
  "DUPLICATE",
  "RESOLUTION",
] as const;

function isSceneName(value: string): value is SceneName {
  return (SCENE_ORDER as readonly string[]).includes(value);
}

function isRelationship(value: string): value is PredictedRelationship {
  return (RELATIONSHIP_ORDER as readonly string[]).includes(value);
}

function reasonFor(report: DashboardReport): string {
  const parts: string[] = [];
  if (report.correlation.decision === "DUPLICATE_REPORT") {
    parts.push("Duplicate of an already processed report");
  } else if (report.correlation.decision === "NEW_INCIDENT") {
    parts.push("New incident from this report");
  } else if (report.correlation.matchStatus === "AMBIGUOUS") {
    parts.push("Ambiguous match — attached with human review");
  } else {
    parts.push("Matched existing incident");
  }
  if (report.conflicts.conflictExists) parts.push("conflict detected");
  if (report.human_review) parts.push("human review");
  return parts.join(" · ");
}

function servicesFor(report: DashboardReport): string {
  const ids = new Set<string>();
  for (const action of report.actions) {
    if (action.service_id) ids.add(action.service_id);
  }
  return ids.size === 0 ? "—" : [...ids].join(", ");
}

interface PageProps {
  searchParams: Promise<{
    scene?: string | string[];
    relationship?: string | string[];
  }>;
}

export default async function DecisionsPage({ searchParams }: PageProps) {
  const data = loadDashboardData();
  const params = await searchParams;

  const rawScene = Array.isArray(params.scene) ? params.scene[0] : params.scene;
  const rawRelationship = Array.isArray(params.relationship)
    ? params.relationship[0]
    : params.relationship;

  const activeScene: SceneName | null =
    rawScene && isSceneName(rawScene) ? rawScene : null;
  const activeRelationship: PredictedRelationship | null =
    rawRelationship && isRelationship(rawRelationship)
      ? rawRelationship
      : null;

  const reports = [...data.reports]
    .sort((a, b) => a.processingOrder - b.processingOrder)
    .filter((report) => !activeScene || report.scene === activeScene)
    .filter(
      (report) => !activeRelationship || report.relationship === activeRelationship,
    );

  const hasFilter = activeScene !== null || activeRelationship !== null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Decision Log
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {hasFilter
              ? `Filtered — ${reports.length} of ${data.reports.length} reports.`
              : `Every processed report in supplied order — ${reports.length} total.`}
          </p>
          {hasFilter && (
            <Link
              href="/decisions"
              className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
            >
              Clear filters
            </Link>
          )}
        </header>

        <section className="mb-4 flex flex-wrap gap-4">
          <FilterForm
            activeScene={activeScene}
            activeRelationship={activeRelationship}
          />
        </section>

        {reports.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No reports match the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-medium text-right">#</th>
                  <th className="px-3 py-3 font-medium">Report</th>
                  <th className="px-3 py-3 font-medium">Incident</th>
                  <th className="px-3 py-3 font-medium">Relationship</th>
                  <th className="px-3 py-3 font-medium">Severity</th>
                  <th className="px-3 py-3 font-medium">Confidence</th>
                  <th className="px-3 py-3 font-medium">Decision</th>
                  <th className="px-3 py-3 font-medium">Service</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.map((report) => (
                  <tr
                    key={report.report_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-500 dark:text-slate-400">
                      {report.processingOrder}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {report.report_id}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/incidents/${encodeURIComponent(report.incident_id)}`}
                        className="font-medium text-sky-700 hover:underline dark:text-sky-300"
                      >
                        {report.incident_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={relationshipToneFromString(report.relationship)}
                      >
                        {report.relationship}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={severityToneFromString(report.severity)}>
                        {report.severity}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
                      {report.correlation.confidence.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                      {report.correlation.decision}
                      {report.correlation.matchStatus !== "MATCHED" && (
                        <span className="ml-1 text-slate-500 dark:text-slate-400">
                          ({report.correlation.matchStatus})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {servicesFor(report)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={statusToneFromString(report.incident_status)}>
                        {report.incident_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      {reasonFor(report)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function FilterForm({
  activeScene,
  activeRelationship,
}: {
  activeScene: SceneName | null;
  activeRelationship: PredictedRelationship | null;
}) {
  return (
    <form
      method="get"
      action="/decisions"
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Scene
        <select
          name="scene"
          defaultValue={activeScene ?? ""}
          className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All</option>
          {SCENE_ORDER.map((scene) => (
            <option key={scene} value={scene}>
              {sceneLabel(scene)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Relationship
        <select
          name="relationship"
          defaultValue={activeRelationship ?? ""}
          className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All</option>
          {RELATIONSHIP_ORDER.map((relationship) => (
            <option key={relationship} value={relationship}>
              {relationship}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        Apply
      </button>
    </form>
  );
}