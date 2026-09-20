import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { orchestrateReport } from "@/domain/orchestration";
import type { OrchestrationState } from "@/domain/orchestration";
import type { RawReportInput } from "@/types/report";
import { toPrediction } from "@/output/vocabulary";
import type { Prediction } from "@/output/types";

interface Args {
  input: string;
  output: string;
}

function parseArgs(argv: readonly string[]): Args {
  let input = "data/campus_reports.csv";
  let output = "predictions.jsonl";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) input = argv[i + 1];
    if (arg === "--output" && argv[i + 1]) output = argv[i + 1];
  }
  return { input, output };
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

  reports.forEach((report, processingOrder) => {
    const result = orchestrateReport({ report, processingOrder, state });
    state = result.state;
    predictions.push(toPrediction(result));
  });

  writeJsonl(args.output, predictions);
    console.log(`Wrote ${predictions.length} predictions to ${args.output}`);
}

main();