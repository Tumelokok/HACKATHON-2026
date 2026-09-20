import Link from "next/link";
import { Nav } from "./components/Nav";
import { loadDashboardData } from "@/dashboard/loader";
import {
  SCENE_ORDER,
  sceneCounts,
  sceneDescription,
  sceneLabel,
  summaryCounts,
} from "@/dashboard/scenes";
import type { SceneName } from "@/dashboard/types";

export const dynamic = "force-static";

export default function Home() {
  const data = loadDashboardData();
  const counts = sceneCounts(data);
  const summary = summaryCounts(data);

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Campus Crisis Agent
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Observe · Correlate · Assess · Decide · Act · Record · Monitor ·
            Reassess. A deterministic pipeline with a bounded agent as decision
            support. The application owns truth.
          </p>
        </section>

        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Incidents" value={summary.incidents} />
          <SummaryCard label="Reports" value={summary.reports} />
          <SummaryCard label="Conflicts" value={summary.conflicts} />
          <SummaryCard label="Human reviews" value={summary.humanReviews} />
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Judge scenarios
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SCENE_ORDER.filter((scene) => scene !== "OTHER").map((scene) => (
              <SceneTile
                key={scene}
                scene={scene}
                incidentCount={counts[scene]}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Full corpus
          </h2>
          <p className="mb-4 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Every processed report in supplied file order. The decision log
            shows exactly what the pipeline decided for each report.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/decisions"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Open decision log ({summary.reports} reports)
            </Link>
            <Link
              href="/replay"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Step through replay
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
        {value}
      </div>
    </div>
  );
}

function SceneTile({
  scene,
  incidentCount,
}: {
  scene: SceneName;
  incidentCount: number;
}) {
  return (
    <Link
      href={`/incidents?scene=${scene}`}
      className="group rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-orange-400 hover:bg-orange-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-orange-500 dark:hover:bg-slate-800"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {sceneLabel(scene)}
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {incidentCount} incident{incidentCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {sceneDescription(scene)}
      </p>
    </Link>
  );
}