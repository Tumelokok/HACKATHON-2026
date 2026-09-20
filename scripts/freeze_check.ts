// Freeze checklist runner for the Campus Crisis Agent submission.
//
// Runs the checks named in the Technical and Submission Guide's freeze
// checklist and prints one PASS/FAIL line per item. Exits non-zero if
// any check fails.
//
// Usage: npm run freeze-check

import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const REPO_ROOT = process.cwd();
const CSV_PATH = resolve(REPO_ROOT, "data/campus_reports.csv");
const JSONL_PATH = resolve(REPO_ROOT, "predictions.jsonl");
const DASHBOARD_PATH = resolve(REPO_ROOT, "dashboard-data.json");

const VALID_RELATIONSHIPS = new Set([
  "NEW",
  "UPDATE",
  "CORROBORATION",
  "CONFLICT",
  "DUPLICATE",
  "RESOLUTION",
]);
const VALID_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const VALID_STATUSES = new Set([
  "INVESTIGATING",
  "ACTIVE",
  "ESCALATED",
  "CONTROLLED",
  "RESOLVED",
]);

function run(command: string): void {
  execSync(command, { cwd: REPO_ROOT, stdio: "pipe" });
}

function readCsvReportIds(): string[] {
  const raw = readFileSync(CSV_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines[0].split(",");
  const idIndex = header.indexOf("report_id");
  if (idIndex === -1) throw new Error("CSV is missing a report_id column");
  const ids: string[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const first = lines[i].split(",")[idIndex];
    if (first !== undefined) ids.push(first);
  }
  return ids;
}

const results: CheckResult[] = [];

// 1. Clean start: remove generated outputs, regenerate, confirm they exist.
try {
  if (existsSync(JSONL_PATH)) unlinkSync(JSONL_PATH);
  if (existsSync(DASHBOARD_PATH)) unlinkSync(DASHBOARD_PATH);
  run("npm run predictions");
  const jsonlExists = existsSync(JSONL_PATH);
  const dashboardExists = existsSync(DASHBOARD_PATH);
  results.push({
    name: "Clean start regenerates predictions.jsonl and dashboard-data.json",
    passed: jsonlExists && dashboardExists,
    detail: `predictions.jsonl=${jsonlExists}, dashboard-data.json=${dashboardExists}`,
  });
} catch (error) {
  results.push({
    name: "Clean start regenerates predictions.jsonl and dashboard-data.json",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 2. Valid JSONL: every line parses, no blank lines.
let parsedPredictions: Array<Record<string, unknown>> = [];
try {
  const raw = readFileSync(JSONL_PATH, "utf8");
  const rawLines = raw.split(/\r?\n/);
  const nonEmpty = rawLines.filter((line) => line.length > 0);
  const trailing = rawLines[rawLines.length - 1];
  const noBlankLines = nonEmpty.length === rawLines.length - (trailing === "" ? 1 : 0);
  parsedPredictions = nonEmpty.map((line) => JSON.parse(line) as Record<string, unknown>);
  results.push({
    name: "predictions.jsonl is valid JSONL with no blank lines",
    passed: noBlankLines && parsedPredictions.length === nonEmpty.length,
    detail: `${parsedPredictions.length} lines parsed`,
  });
} catch (error) {
  results.push({
    name: "predictions.jsonl is valid JSONL with no blank lines",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 3. One line per CSV report.
let csvIds: string[] = [];
try {
  csvIds = readCsvReportIds();
  results.push({
    name: "One prediction line per CSV report",
    passed: parsedPredictions.length === csvIds.length,
    detail: `csv=${csvIds.length}, jsonl=${parsedPredictions.length}`,
  });
} catch (error) {
  results.push({
    name: "One prediction line per CSV report",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 4. Report IDs match the CSV, in order.
try {
  const jsonlIds = parsedPredictions.map((p) => String(p.report_id));
  const match =
    jsonlIds.length === csvIds.length &&
    jsonlIds.every((id, index) => id === csvIds[index]);
  const missing = csvIds.filter((id) => !jsonlIds.includes(id));
  const extra = jsonlIds.filter((id) => !csvIds.includes(id));
  results.push({
    name: "Report IDs match the input CSV in file order",
    passed: match,
    detail: match
      ? `${jsonlIds.length} IDs matched in order`
      : `missing=${missing.length}, extra=${extra.length}`,
  });
} catch (error) {
  results.push({
    name: "Report IDs match the input CSV in file order",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 5. Required fields present with valid enum values.
try {
  const problems: string[] = [];
  for (const p of parsedPredictions) {
    const id = String(p.report_id);
    if (typeof p.report_id !== "string") problems.push(`${id}: report_id`);
    if (typeof p.incident_id !== "string") problems.push(`${id}: incident_id`);
    if (!VALID_RELATIONSHIPS.has(String(p.relationship)))
      problems.push(`${id}: relationship=${p.relationship}`);
    if (!VALID_SEVERITIES.has(String(p.severity)))
      problems.push(`${id}: severity=${p.severity}`);
    if (typeof p.confidence !== "number" || p.confidence < 0 || p.confidence > 1)
      problems.push(`${id}: confidence=${p.confidence}`);
    if (!Array.isArray(p.actions)) problems.push(`${id}: actions not array`);
    if (!VALID_STATUSES.has(String(p.incident_status)))
      problems.push(`${id}: incident_status=${p.incident_status}`);
    if (typeof p.human_review !== "boolean")
      problems.push(`${id}: human_review=${p.human_review}`);
  }
  results.push({
    name: "Required JSONL fields present and valid",
    passed: problems.length === 0,
    detail: problems.length === 0 ? "all fields valid" : problems.slice(0, 5).join("; "),
  });
} catch (error) {
  results.push({
    name: "Required JSONL fields present and valid",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 6. Dashboard agrees with the JSONL on report_id -> relationship/severity/status.
try {
  const dashboard = JSON.parse(readFileSync(DASHBOARD_PATH, "utf8")) as {
    reports: Array<{
      report_id: string;
      relationship: string;
      severity: string;
      incident_status: string;
    }>;
  };
  const jsonlById = new Map(
    parsedPredictions.map((p) => [String(p.report_id), p] as const),
  );
  const mismatches: string[] = [];
  for (const dr of dashboard.reports) {
    const jp = jsonlById.get(dr.report_id);
    if (!jp) {
      mismatches.push(`${dr.report_id}: missing from jsonl`);
      continue;
    }
    if (jp.relationship !== dr.relationship)
      mismatches.push(`${dr.report_id}: relationship`);
    if (jp.severity !== dr.severity) mismatches.push(`${dr.report_id}: severity`);
    if (jp.incident_status !== dr.incident_status)
      mismatches.push(`${dr.report_id}: incident_status`);
  }
  results.push({
    name: "Dashboard decisions match predictions.jsonl",
    passed: mismatches.length === 0,
    detail:
      mismatches.length === 0
        ? `all ${dashboard.reports.length} reports agree`
        : mismatches.slice(0, 5).join("; "),
  });
} catch (error) {
  results.push({
    name: "Dashboard decisions match predictions.jsonl",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 7. No secrets or .env files.
//
// Only look for patterns that indicate an actual assigned credential
// value, not prose that documents the practice of keeping secrets out
// of the repository. A high-entropy token or a literal assignment is
// what we care about.
try {
  const grepResult = execSync(
    `grep -rInE "(api[_-]?key|apikey|access[_-]?token|client[_-]?secret|password)[\\"']?\\s*[:=]\\s*[\\"'][A-Za-z0-9_\\-]{16,}" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "package-lock.json" || true`,
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const envFile = existsSync(resolve(REPO_ROOT, ".env"));
  const envExampleOk = !existsSync(resolve(REPO_ROOT, ".env.example")) ||
    existsSync(resolve(REPO_ROOT, ".env.example"));
  results.push({
    name: "No secrets and no committed .env file",
    passed: grepResult.trim().length === 0 && !envFile && envExampleOk,
    detail:
      grepResult.trim().length === 0 && !envFile
        ? "clean"
        : `grep hits: ${grepResult.split("\n").filter(Boolean).slice(0, 3).join(" | ")}; .env=${envFile}`,
  });
} catch (error) {
  results.push({
    name: "No secrets and no committed .env file",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 8. No reference to hidden data.
//
// Exclude this script from the search: it necessarily contains the
// strings it is looking for. Only flag a path reference to the hidden
// data directory, or a run of U-series report IDs, not the phrase
// "hidden data" in documentation.
try {
  const hidden = execSync(
    `grep -rInE "(05_Hidden_Data|hidden_data|/hidden/)" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.csv" . 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "scripts/freeze_check.ts" || true`,
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const uSeries = execSync(
    `grep -rInE "\\bU0[0-9][0-9]\\b" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.csv" . 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "scripts/freeze_check.ts" || true`,
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const hits = [...hidden.split("\n"), ...uSeries.split("\n")].filter(Boolean);
  results.push({
    name: "No reference to hidden data in the repository",
    passed: hits.length === 0,
    detail: hits.length === 0 ? "clean" : hits.slice(0, 3).join(" | "),
  });
} catch (error) {
  results.push({
    name: "No reference to hidden data in the repository",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// 9. Tests and replay pass.
try {
  execSync("npm test", { cwd: REPO_ROOT, stdio: "pipe" });
  execSync("npm run replay", { cwd: REPO_ROOT, stdio: "pipe" });
  results.push({
    name: "Domain tests and replay harness pass",
    passed: true,
    detail: "npm test and npm run replay both exited 0",
  });
} catch (error) {
  results.push({
    name: "Domain tests and replay harness pass",
    passed: false,
    detail: error instanceof Error ? error.message : String(error),
  });
}

// Report.
console.log("");
console.log("Freeze checklist");
console.log("================");
let allPassed = true;
for (const result of results) {
  const tag = result.passed ? "PASS" : "FAIL";
  if (!result.passed) allPassed = false;
  console.log(`[${tag}] ${result.name}`);
  console.log(`        ${result.detail}`);
}
console.log("");
console.log(allPassed ? "All checks passed." : "One or more checks failed.");
process.exit(allPassed ? 0 : 1); 