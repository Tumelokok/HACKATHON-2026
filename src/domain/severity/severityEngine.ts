import type { NormalizedReport } from "@/types/report";
import type {
  SeverityAssessment,
  SeverityAssessmentResult,
  SeverityConflictSignal,
  SeverityContext,
  SeverityInput,
  SeverityLevel,
  SeverityProcessingResult,
  SeverityState,
} from "./types";

const severityRank: Readonly<Record<SeverityLevel, number>> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const confidenceValues = {
  noEvidence: 0.5,
  singleReport: 0.75,
  corroborated: 0.9,
  conflicting: 0.55,
} as const;

const criticalPhrases = [
  ["fire", "spreading"],
  ["immediate", "threat"],
  ["critical", "infrastructure", "failure"],
  ["multiple", "people", "injured"],
] as const;

const highIndicators = [
  "fire",
  "smoke",
  "trapped",
  "injury",
  "injured",
  "evacuation",
  "evacuated",
  "security",
  "danger",
  "dangerous",
  "threat",
  "electrical",
] as const;

const mediumIndicators = [
  "outage",
  "unavailable",
  "disruption",
  "affecting",
  "campus-wide",
  "multiple",
  "impact",
] as const;

const controlIndicators = [
  "restored",
  "restoration",
  "repaired",
  "repair",
  "controlled",
  "control",
  "resolved",
  "resolution",
  "released",
  "release",
  "safe",
  "closed",
] as const;

function tokens(value: string): ReadonlySet<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}-]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1),
  );
}

function hasPhrase(report: NormalizedReport, phrase: readonly string[]): boolean {
  const reportTokens = tokens(report.descriptionRaw);
  return phrase.every((token) => reportTokens.has(token));
}

function hasAnyToken(report: NormalizedReport, indicators: readonly string[]): boolean {
  const reportTokens = tokens(report.descriptionRaw);
  return indicators.some((indicator) => reportTokens.has(indicator));
}

function isControlReport(report: NormalizedReport): boolean {
  return hasAnyToken(report, controlIndicators);
}

function reportedLevel(report: NormalizedReport): SeverityLevel {
  switch (report.reportedSeverityNormalized) {
    case "LOW":
      return "LOW";
    case "MEDIUM":
      return "MEDIUM";
    case "HIGH":
      return "HIGH";
    case "CRITICAL":
      return "CRITICAL";
    default:
      return "LOW";
  }
}

function reportLevel(report: NormalizedReport, context: SeverityContext): SeverityLevel {
  if (
    criticalPhrases.some((phrase) => hasPhrase(report, phrase)) ||
    context.operationalImpact === "CRITICAL" ||
    (context.immediateDanger === true && hasAnyToken(report, ["immediate", "extreme"]))
  ) {
    return "CRITICAL";
  }

  if (
    report.categoryNormalized === "FIRE" ||
    report.categoryNormalized === "SMOKE" ||
    report.categoryNormalized === "ELECTRICAL" ||
    report.categoryNormalized === "SECURITY" ||
    report.categoryNormalized === "LIFT" ||
    hasAnyToken(report, highIndicators) ||
    context.immediateDanger === true ||
    context.affectedPeople === "MANY" ||
    context.escalationEvidence === true
  ) {
    return "HIGH";
  }

  if (
    hasAnyToken(report, mediumIndicators) ||
    context.operationalImpact === "WIDESPREAD" ||
    context.operationalImpact === "LIMITED" ||
    context.affectedPeople === "SOME"
  ) {
    return "MEDIUM";
  }

  return reportedLevel(report);
}

function lowerSeverity(level: SeverityLevel): SeverityLevel {
  if (level === "CRITICAL") {
    return "HIGH";
  }
  if (level === "HIGH") {
    return "MEDIUM";
  }
  if (level === "MEDIUM") {
    return "LOW";
  }
  return "LOW";
}

function findSeverityConflict(
  reports: readonly NormalizedReport[],
): SeverityConflictSignal | null {
  for (let index = 1; index < reports.length; index += 1) {
    const previousReport = reports[index - 1];
    const currentReport = reports[index];
    if (
      severityRank[reportedLevel(currentReport)] < severityRank[reportedLevel(previousReport)] &&
      !isControlReport(currentReport)
    ) {
      return {
        type: "CONTRADICTORY_SEVERITY_EVIDENCE",
        reportIds: [previousReport.report_id, currentReport.report_id],
        reason: "A later lower reported severity conflicts with earlier severity evidence",
      };
    }
  }

  return null;
}

function confidenceFor(
  reportCount: number,
  conflict: SeverityConflictSignal | null,
): number {
  if (conflict) {
    return confidenceValues.conflicting;
  }
  if (reportCount === 0) {
    return confidenceValues.noEvidence;
  }
  return reportCount > 1 ? confidenceValues.corroborated : confidenceValues.singleReport;
}

function reasonFor(
  level: SeverityLevel,
  reports: readonly NormalizedReport[],
  conflict: SeverityConflictSignal | null,
): string {
  const reportIds = reports.map((report) => report.report_id).join(", ") || "none";
  const safetyReason = level === "HIGH" || level === "CRITICAL"
    ? "Safety-relevant evidence establishes a severity floor."
    : "No immediate-danger evidence establishes a higher severity floor.";
  const conflictReason = conflict ? " Contradictory severity evidence requires human review." : "";
  return `${level} assessment based on reports: ${reportIds}. ${safetyReason}${conflictReason}`;
}

export function createSeverityState(): SeverityState {
  return { assessments: [] };
}

export function assessSeverity(input: SeverityInput): SeverityAssessmentResult {
  const context = input.context ?? {};
  let currentLevel: SeverityLevel = "LOW";
  let activeSafetyFloor: SeverityLevel = "LOW";

  for (const report of input.reports) {
    const level = reportLevel(report, context);
    currentLevel = severityRank[level] > severityRank[currentLevel] ? level : currentLevel;

    if (severityRank[level] >= severityRank.HIGH) {
      activeSafetyFloor = severityRank[level] > severityRank[activeSafetyFloor]
        ? level
        : activeSafetyFloor;
    }

    if (isControlReport(report)) {
      currentLevel = lowerSeverity(currentLevel);
      // Safety floor is monotonic: control evidence can reduce the live level,
      // but an incident's historical severity floor is never erased.
    }

    if (severityRank[activeSafetyFloor] > severityRank[currentLevel]) {
      currentLevel = activeSafetyFloor;
    }
  }

  const conflict = findSeverityConflict(input.reports);
  const assessment: SeverityAssessment = {
    incidentId: input.incidentId,
    level: currentLevel,
    confidence: confidenceFor(input.reports.length, conflict),
    reason: reasonFor(currentLevel, input.reports, conflict),
    evidenceReportIds: input.reports.map((report) => report.report_id),
    source: "RULE_ENGINE",
    createdAt: input.assessedAt,
    conflict,
    requiresHumanReview: conflict !== null || context.conflictEvidence === true,
  };

  return { assessment, evidenceReports: input.reports };
}

export function reassessIncident(
  input: SeverityInput,
  state: SeverityState,
): SeverityProcessingResult {
  const result = assessSeverity(input);
  const assessments = [...state.assessments, result.assessment];
  return { ...result, state: { assessments } };
}