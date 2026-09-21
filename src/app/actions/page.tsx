import Link from "next/link";
import { Nav } from "../components/Nav";
import { Badge } from "../components/Badge";
import { loadDashboardData } from "@/dashboard/loader";
import type { DashboardAction, DashboardReport } from "@/dashboard/types";

export const dynamic = "force-dynamic";

interface ActionRow {
  report: DashboardReport;
  action: DashboardAction;
}

function statusTone(
  status: DashboardAction["status"],
): "resolved" | "controlled" | "escalated" | "conflict" | "neutral" {
  switch (status) {
    case "EXECUTED":
      return "resolved";
    case "APPROVED":
      return "controlled";
    case "REJECTED":
      return "escalated";
    case "FAILED":
      return "conflict";
    case "SUPPRESSED":
    case "PROPOSED":
      return "neutral";
    default:
      return "neutral";
  }
}

interface PageProps {
  searchParams: Promise<{
    status?: string | string[];
    type?: string | string[];
  }>;
}

export default async function ActionsPage({ searchParams }: PageProps) {
  const data = loadDashboardData();
  const params = await searchParams;

  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;

  const rows: ActionRow[] = [];
  for (const report of data.reports) {
    for (const action of report.actions) {
      rows.push({ report, action });
    }
  }
  rows.sort((a, b) => a.report.processingOrder - b.report.processingOrder);

  const allStatuses: readonly string[] = [...new Set(rows.map((r) => r.action.status))].sort();
  const allTypes: readonly string[] = [...new Set(rows.map((r) => r.action.type))].sort();

  const activeStatus = rawStatus && allStatuses.includes(rawStatus) ? rawStatus : null;
  const activeType = rawType && allTypes.includes(rawType) ? rawType : null;

  const filtered = rows
    .filter((r) => !activeStatus || r.action.status === activeStatus)
    .filter((r) => !activeType || r.action.type === activeType);

  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.action.status] = (byStatus[r.action.status] ?? 0) + 1;
  }

  const hasFilter = activeStatus !== null || activeType !== null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Action History
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Every action that entered the policy engine, with its service,
            status, and the policy reason. Suppressed actions are proposals
            that were rejected as duplicates — they show that repeated
            reports did not cause repeated dispatches.
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {hasFilter
              ? `Filtered — ${filtered.length} of ${rows.length} actions.`
              : `${rows.length} actions across ${data.reports.length} reports.`}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {allStatuses.map((s) => `${s}: ${byStatus[s] ?? 0}`).join(" · ")}
          </p>
          {hasFilter && (
            <Link
              href="/actions"
              className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
            >
              Clear filters
            </Link>
          )}
        </header>

        <section className="mb-4">
          <FilterForm
            statuses={allStatuses}
            types={allTypes}
            activeStatus={activeStatus}
            activeType={activeType}
          />
        </section>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No actions match the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-medium text-right">#</th>
                  <th className="px-3 py-3 font-medium">Report</th>
                  <th className="px-3 py-3 font-medium">Incident</th>
                  <th className="px-3 py-3 font-medium">Time</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                  <th className="px-3 py-3 font-medium">Service</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(({ report, action }, index) => (
                  <tr
                    key={`${report.report_id}-${action.type}-${index}`}
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
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      {report.raw.timestamp || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {action.type}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {action.service_id ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={statusTone(action.status)}>
                        {action.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      {action.policyReason ?? "—"}
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
  statuses,
  types,
  activeStatus,
  activeType,
}: {
  statuses: readonly string[];
  types: readonly string[];
  activeStatus: string | null;
  activeType: string | null;
}) {
  return (
    <form
      method="get"
      action="/actions"
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Status
        <select
          name="status"
          defaultValue={activeStatus ?? ""}
          className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Action type
        <select
          name="type"
          defaultValue={activeType ?? ""}
          className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
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