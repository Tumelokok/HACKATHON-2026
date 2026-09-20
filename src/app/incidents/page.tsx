import Link from "next/link";
import { Nav } from "../components/Nav";
import {
  Badge,
  severityToneFromString,
  statusToneFromString,
} from "../components/Badge";
import { loadDashboardData } from "@/dashboard/loader";
import {
  SCENE_ORDER,
  incidentsForScene,
  sceneLabel,
} from "@/dashboard/scenes";
import type { DashboardIncident, SceneName } from "@/dashboard/types";

export const dynamic = "force-dynamic";

function isSceneName(value: string): value is SceneName {
  return (SCENE_ORDER as readonly string[]).includes(value);
}

interface PageProps {
  searchParams: Promise<{ scene?: string | string[] }>;
}

export default async function IncidentsPage({ searchParams }: PageProps) {
  const data = loadDashboardData();
  const params = await searchParams;

  const rawScene = Array.isArray(params.scene) ? params.scene[0] : params.scene;
  const activeScene: SceneName | null =
    rawScene && isSceneName(rawScene) ? rawScene : null;

  const incidents: readonly DashboardIncident[] = activeScene
    ? incidentsForScene(data, activeScene)
    : [...data.incidents].sort(
        (a, b) => a.firstProcessingOrder - b.firstProcessingOrder,
      );

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Incident Summary
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {activeScene
              ? `Filtered to ${sceneLabel(activeScene)} — ${incidents.length} incident${incidents.length === 1 ? "" : "s"}.`
              : `All incidents in processing order — ${incidents.length} total.`}
          </p>
          {activeScene && (
            <Link
              href="/incidents"
              className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
            >
              Clear filter
            </Link>
          )}
        </header>

        {incidents.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No incidents for this scene.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Incident</th>
                  <th className="px-4 py-3 font-medium">Scene</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium text-right">Reports</th>
                  <th className="px-4 py-3 font-medium">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {incidents.map((incident) => (
                  <tr
                    key={incident.incident_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/incidents/${encodeURIComponent(incident.incident_id)}`}
                        className="font-medium text-sky-700 hover:underline dark:text-sky-300"
                      >
                        {incident.incident_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {sceneLabel(incident.scene)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {incident.category}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {incident.location}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={severityToneFromString(incident.currentSeverity)}
                      >
                        {incident.currentSeverity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={statusToneFromString(incident.currentStatus)}
                      >
                        {incident.currentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                      {incident.currentConfidence.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {incident.reportIds.length}
                    </td>
                    <td className="px-4 py-3">
                      {incident.human_review ? (
                        <Badge
                          tone="neutral"
                          title="At least one report in this incident is flagged for human review"
                        >
                          Review
                        </Badge>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">
                          —
                        </span>
                      )}
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