import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "../../components/Nav";
import {
  Badge,
  severityToneFromString,
  statusToneFromString,
  relationshipToneFromString,
} from "../../components/Badge";
import {
  getIncidentById,
  getReportsForIncident,
  loadDashboardData,
} from "@/dashboard/loader";
import { sceneLabel } from "@/dashboard/scenes";
import type { DashboardReport } from "@/dashboard/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ incidentId: string }>;
}

export default async function IncidentDetailPage({ params }: PageProps) {
  const { incidentId } = await params;
  const data = loadDashboardData();

  const incident = getIncidentById(data, incidentId);
  if (!incident) {
    notFound();
  }

  const reports = getReportsForIncident(data, incidentId);
  const latestReport = reports[reports.length - 1];
  const allActions = reports.flatMap((report) =>
    report.actions.map((action) => ({ report, action })),
  );
  const allTransitions = reports.flatMap((report) =>
    report.lifecycleTransitions.map((transition) => ({ report, transition })),
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-4">
          <Link
            href="/incidents"
            className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
          >
            ← Back to incidents
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {incident.incident_id}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={severityToneFromString(incident.currentSeverity)}>
              {incident.currentSeverity}
            </Badge>
            <Badge tone={statusToneFromString(incident.currentStatus)}>
              {incident.currentStatus}
            </Badge>
            <Badge tone="neutral">{sceneLabel(incident.scene)}</Badge>
            {incident.human_review && (
              <Badge
                tone="neutral"
                title="At least one report in this incident is flagged for human review"
              >
                Human review
              </Badge>
            )}
          </div>
        </header>

        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Current assessment
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Field label="Category" value={incident.category} />
            <Field label="Location" value={incident.location} />
            <Field
              label="Confidence"
              value={incident.currentConfidence.toFixed(2)}
            />
            <Field
              label="Reports"
              value={String(incident.reportIds.length)}
            />
            <Field
              label="Services engaged"
              value={
                incident.services.length === 0
                  ? "None"
                  : incident.services.join(", ")
              }
            />
            <Field
              label="First processed"
              value={`#${incident.firstProcessingOrder}`}
            />
          </dl>
          {latestReport && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Latest report — {latestReport.report_id}
              </div>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                {latestReport.raw.description}
              </p>
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Report timeline ({reports.length})
          </h2>
          <ol className="space-y-3">
            {reports.map((report) => (
              <ReportRow key={report.report_id} report={report} />
            ))}
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Action history ({allActions.length})
          </h2>
          {allActions.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No actions recorded for this incident.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Report</th>
                      <th className="px-4 py-2 font-medium">Action</th>
                      <th className="px-4 py-2 font-medium">Service</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Reason</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allActions.map(({ report, action }, index) => (
                    <tr key={`${report.report_id}-${index}`}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {report.report_id}
                      </td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                        {action.type}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {action.service_id ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
                        {action.status}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
                        {action.policyReason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Lifecycle transitions ({allTransitions.length})
          </h2>
          {allTransitions.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No lifecycle transitions recorded for this incident.
            </p>
          ) : (
            <ol className="space-y-2">
              {allTransitions.map(({ report, transition }, index) => (
                <li
                  key={`${report.report_id}-transition-${index}`}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={transition.accepted ? "resolved" : "neutral"}>
                      {transition.accepted ? "Accepted" : "Rejected"}
                    </Badge>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                      {transition.fromState} → {transition.resultingState}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      via {report.report_id}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {transition.reason}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function ReportRow({ report }: { report: DashboardReport }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium text-slate-900 dark:text-slate-50">
          {report.report_id}
        </span>
        <Badge tone={relationshipToneFromString(report.relationship)}>
          {report.relationship}
        </Badge>
        <Badge tone={severityToneFromString(report.severity)}>
          {report.severity}
        </Badge>
        {report.human_review && (
          <Badge tone="neutral" title="Flagged for human review">
            Review
          </Badge>
        )}
        {report.conflicts.conflictExists && (
          <Badge
            tone="conflict"
            title={`Conflict: ${report.conflicts.conflictType ?? "unknown"}`}
          >
            Conflict
          </Badge>
        )}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          #{report.processingOrder} · {report.raw.timestamp} · {report.raw.reporter_type}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
        {report.raw.description}
      </p>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Correlation: {report.correlation.decision} ({report.correlation.matchStatus},{" "}
          {report.correlation.confidence.toFixed(2)})
        </span>
        <span>
          Normalized: {report.normalized.categoryNormalized} at{" "}
          {report.normalized.locationNormalized}
        </span>
      </div>
    </li>
  );
}