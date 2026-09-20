import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { orchestrateReport } from "@/domain/orchestration";
import type { OrchestrationState } from "@/domain/orchestration";
import type { RawReportInput } from "@/types/report";
import { toPrediction } from "@/output/vocabulary";
import type { Prediction } from "@/output/types";
import type {
  DashboardData,
  DashboardIncident,
  DashboardReport,
  SceneName,
} from "@/dashboard/types";

interface Args {
  input: string;
  output: string;
  dashboardOutput: string;
}

function parseArgs(argv: readonly string[]): Args {
  let input = "data/campus_reports.csv";
  let output = "predictions.jsonl";
  let dashboardOutput = "dashboard-data.json";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) input = argv[i + 1];
    if (arg === "--output" && argv[i + 1]) output = argv[i + 1];
    if (arg === "--dashboard-output" && argv[i + 1]) dashboardOutput = argv[i + 1];
  }
  return { input, output, dashboardOutput };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function loadReports(path: string): RawReportInput[] {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) throw new Error("CSV must have a header and at least one record");

  const header = parseCsvLine(lines[0]);
  const index = (name: string): number => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Missing CSV column: ${name}`);
    return i;
  };
  const iReport = index("report_id");
  const iTimestamp = index("timestamp");
  const iLocation = index("location");
  const iCategory = index("category");
  const iSeverity = index("reported_severity");
  const iDescription = index("description");
  const iReporter = index("reporter_type");

  const reports: RawReportInput[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i]);
    reports.push({
      report_id: fields[iReport] ?? "",
      timestamp: fields[iTimestamp] ?? "",
      location: fields[iLocation] ?? "",
      category: fields[iCategory] ?? "",
      reported_severity: fields[iSeverity] ?? "",
      description: fields[iDescription] ?? "",
      reporter_type: fields[iReporter] ?? "",
    });
  }
  return reports;
}

function sceneFromCategory(categoryNormalized: string): SceneName {
  switch (categoryNormalized) {
    case "NETWORK_OUTAGE":
      return "NETWORK_OUTAGE";
    case "FIRE":
    case "SMOKE":
    case "ELECTRICAL":
      return "SMOKE_ELECTRICAL";
    case "SECURITY":
      return "CONTRACTOR_VERIFICATION";
    case "LIFT":
    case "ACCESSIBILITY":
      return "LIFT_ACCESSIBILITY";
    default:
      return "OTHER";
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeJsonl(path: string, predictions: readonly Prediction[]): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const lines = predictions.map((p) => JSON.stringify(p));
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const reports = loadReports(args.input);

  let state: OrchestrationState | undefined;
  const predictions: Prediction[] = [];
  const dashboardReports: DashboardReport[] = [];
  const incidents = new Map<string, DashboardIncident>();

  reports.forEach((report, processingOrder) => {
    const result = orchestrateReport({ report, processingOrder, state });
    state = result.state;

    const prediction = toPrediction(result);
    predictions.push(prediction);

    const scene = sceneFromCategory(result.report.categoryNormalized);

    dashboardReports.push({
      report_id: prediction.report_id,
      processingOrder,
      incident_id: prediction.incident_id,
      relationship: prediction.relationship,
      severity: prediction.severity,
      severityConfidence:
        result.processing.severityAssessment?.confidence ?? 0,
      correlationConfidence:
        result.processing.correlationResult.confidence,
      actions: prediction.actions,
      incident_status: prediction.incident_status,
      human_review: prediction.human_review,
      scene,
      raw: report,
      normalized: {
        locationNormalized: result.report.locationNormalized,
        categoryNormalized: result.report.categoryNormalized,
        reportedSeverityNormalized: result.report.reportedSeverityNormalized,
        reporterTypeNormalized: result.report.reporterTypeNormalized,
        timestampParsed: result.report.timestampParsed
          ? result.report.timestampParsed.toISOString()
          : null,
      },
      correlation: {
        decision: result.processing.correlationResult.decision,
        matchStatus: result.processing.correlationResult.matchStatus,
        confidence: result.processing.correlationResult.confidence,
      },
      conflicts: {
        conflictExists: result.processing.conflictResult.conflictExists,
        conflictType: result.processing.conflictResult.conflictType,
        involvedReportIds: result.processing.conflictResult.involvedReportIds,
        requiresHumanReview:
          result.processing.conflictResult.requiresHumanReview,
      },
      lifecycleTransitions: result.lifecycleResults.map((t) => ({
        accepted: t.accepted,
        fromState: t.fromState,
        requestedState: t.requestedState,
        resultingState: t.resultingState,
        reason: t.reason,
      })),
    });

    if (prediction.incident_id && prediction.incident_id !== "standalone") {
      const existing = incidents.get(prediction.incident_id);
      if (existing) {
        existing.reportIds.push(prediction.report_id);
        if (
          prediction.severity !== existing.currentSeverity
        ) {
          existing.currentSeverity = prediction.severity;
        }
        existing.currentStatus = prediction.incident_status;
      } else {
        incidents.set(prediction.incident_id, {
          incident_id: prediction.incident_id,
          scene,
          category: result.report.categoryNormalized,
          location: result.report.locationRaw,
          currentSeverity: prediction.severity,
          currentStatus: prediction.incident_status,
          reportIds: [prediction.report_id],
          firstProcessingOrder: processingOrder,
        });
      }
    }
  });

  writeJsonl(args.output, predictions);
  const data: DashboardData = {
    generatedAt: new Date(0).toISOString(),
    reports: dashboardReports,
    incidents: Array.from(incidents.values()).sort(
      (a, b) => a.firstProcessingOrder - b.firstProcessingOrder,
    ),
  };
  writeJson(args.dashboardOutput, data);

  console.log(`Wrote ${predictions.length} predictions to ${args.output}`);
  console.log(`Wrote ${data.incidents.length} incidents to ${args.dashboardOutput}`);
}

main();