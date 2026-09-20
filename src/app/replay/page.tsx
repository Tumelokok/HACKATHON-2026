import Link from "next/link";
import { Nav } from "../components/Nav";
import { replayScenario, replayScenarios } from "@/domain/replay";
import type {
  ReplayAssertion,
  ReplayReportResult,
  ReplayScenario,
} from "@/domain/replay";

export const dynamic = "force-dynamic";

function scenarioNames(): readonly string[] {
  return replayScenarios.map((scenario) => scenario.name);
}

function findScenario(name: string | null): ReplayScenario {
  const found = replayScenarios.find((scenario) => scenario.name === name);
  return found ?? replayScenarios[0];
}

interface PageProps {
  searchParams: Promise<{ scenario?: string | string[] }>;
}

export default async function ReplayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawScenario = Array.isArray(params.scenario)
    ? params.scenario[0]
    : params.scenario;

  const scenario = findScenario(rawScenario ?? null);
  const evaluation = replayScenario(scenario);

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Replay
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            The four judge scenarios, run through the same deterministic
            pipeline used to produce predictions.jsonl. Reports are processed
            in supplied order, never reordered by timestamp.
          </p>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          {scenarioNames().map((name) => {
            const active = name === scenario.name;
            return (
              <Link
                key={name}
                href={`/replay?scenario=${encodeURIComponent(name)}`}
                className={
                  active
                    ? "rounded-md border border-orange-400 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-900 dark:border-orange-500 dark:bg-orange-950/50 dark:text-orange-100"
                    : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                }
              >
                {name}
              </Link>
            );
          })}
        </nav>

        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-50">
              {scenario.name}
            </h2>
            <span
              className={
                evaluation.passed
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200"
              }
            >
              {evaluation.passed ? "Assertions passed" : "Assertions failed"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {scenario.description}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <SummaryField
              label="Reports"
              value={String(evaluation.summary.reportsProcessed)}
            />
            <SummaryField
              label="Incidents created"
              value={String(evaluation.summary.incidentsCreated)}
            />
            <SummaryField
              label="Duplicates"
              value={String(evaluation.summary.duplicatesDetected)}
            />
            <SummaryField
              label="Conflicts"
              value={String(evaluation.summary.conflictsDetected)}
            />
            <SummaryField
              label="Human reviews"
              value={String(evaluation.summary.humanReviewsRequested)}
            />
            <SummaryField
              label="Actions proposed"
              value={String(evaluation.summary.actionsProposed)}
            />
            <SummaryField
              label="Actions executed"
              value={String(evaluation.summary.actionsExecuted)}
            />
            <SummaryField
              label="Actions suppressed"
              value={String(evaluation.summary.actionsSuppressed)}
            />
          </dl>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Assertions ({evaluation.assertions.filter((a) => a.passed).length}/
            {evaluation.assertions.length} passed)
          </h2>
          <ul className="space-y-2">
            {evaluation.assertions.map((assertion, index) => (
              <AssertionRow key={`${assertion.requirement}-${index}`} assertion={assertion} />
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Trace ({evaluation.trace.length})
          </h2>
          <ol className="space-y-3">
            {evaluation.trace.map((item) => (
              <TraceRow key={`${item.reportId}-${item.processingOrder}`} item={item} />
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 tabular-nums text-slate-800 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}

function AssertionRow({ assertion }: { assertion: ReplayAssertion }) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
      <span
        className={
          assertion.passed
            ? "mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
            : "mt-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200"
        }
      >
        {assertion.passed ? "PASS" : "FAIL"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-slate-800 dark:text-slate-200">
          {assertion.requirement}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {assertion.rubricArea} · evidence: {assertion.evidence.join(", ") || "none"}
        </div>
      </div>
    </li>
  );
}

function TraceRow({ item }: { item: ReplayReportResult }) {
  const latestLifecycle = item.lifecycle[item.lifecycle.length - 1];
  const lastState =
    item.lifecycleState.records[0]?.currentState ?? "—";

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono font-medium text-slate-900 dark:text-slate-50">
          {item.reportId}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          #{item.processingOrder}
        </span>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
          {item.correlation.decision}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {item.correlation.matchStatus}
        </span>
        {item.duplicate && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
            DUPLICATE
          </span>
        )}
        {item.severity && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {item.severity.level}
          </span>
        )}
        {item.conflicts.conflictExists && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-900/40 dark:text-red-200">
            CONFLICT
          </span>
        )}
        {item.agent.decision.decisionType === "REQUEST_HUMAN_REVIEW" && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
            HUMAN REVIEW
          </span>
        )}
        <span className="ml-auto text-slate-500 dark:text-slate-400">
          incident: {item.incidentId ?? "—"} · state: {lastState}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
        {item.rawReport.description}
      </p>

      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2">
        <div>
          Agent: {item.agent.decision.decisionType}
          {item.agent.decision.actionProposal
            ? ` → ${item.agent.decision.actionProposal.actionType}`
            : ""}
        </div>
        <div>
          Actions: {item.actions.length === 0 ? "none" : item.actions.map((action) => `${action.actionType} (${action.status})`).join(", ")}
        </div>
        {latestLifecycle && (
          <div>
            Lifecycle: {latestLifecycle.accepted ? "accepted" : "rejected"} {latestLifecycle.fromState} → {latestLifecycle.resultingState} — {latestLifecycle.reason}
          </div>
        )}
        {item.conflicts.conflictExists && (
          <div>
            Conflict: {item.conflicts.conflictType} involving {item.conflicts.involvedReportIds.join(", ")}
          </div>
        )}
      </div>
    </li>
  );
}