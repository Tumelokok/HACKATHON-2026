import type { NormalizedReport } from "@/types/report";
import type {
  CandidateIncident,
  CandidateIncidentScore,
  CorrelationComponentScore,
  CorrelationConflictSignal,
  CorrelationEvidence,
  CorrelationProcessingResult,
  CorrelationResult,
  CorrelationState,
  DuplicateInformation,
  HumanReviewRequirement,
  ProcessedCorrelationReport,
} from "./types";

export const CORRELATION_CONFIG = {
  weights: {
    location: 0.35,
    category: 0.2,
    description: 0.25,
    context: 0.1,
    activity: 0.1,
  },
  thresholds: {
    existingIncident: 0.75,
    ambiguous: 0.5,
  },
} as const;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "is",
  "of",
  "on",
  "the",
  "to",
]);

const contradictionPairs = [
  ["open", "closed"],
  ["available", "unavailable"],
  ["restored", "outage"],
  ["restored", "down"],
  ["released", "trapped"],
  ["safe", "danger"],
  ["safe", "dangerous"],
] as const;

const followUpConcepts = [
  ["restore", "restoration", "restored"],
  ["repair", "repaired", "repairing"],
  ["resolve", "resolved", "resolution"],
  ["release", "released"],
  ["control", "controlled"],
] as const;

// Explicit duplicate markers. A reporter who resubmits the same information
// labels it as a duplicate. This is the reliable signal for detecting
// semantic duplicates without relying on identical report IDs.
const duplicateMarkers = [
  "duplicate report",
  "duplicate:",
  "repeat report",
  "repeated report",
] as const;

function isDeclaredDuplicate(report: NormalizedReport): boolean {
  const text = report.descriptionRaw.toLowerCase();
  return duplicateMarkers.some((marker) => text.includes(marker));
}

const contextIndicators = [
  "additional",
  "affected",
  "confirm",
  "improving",
  "maintenance",
  "worsening",
  "working",
] as const;

function roundScore(score: number): number {
  return Number(score.toFixed(4));
}

function tokens(value: string): ReadonlySet<string> {
  const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
  return new Set(
    normalized
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stopWords.has(token)),
  );
}

function jaccardSimilarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const intersectionSize = [...left].filter((token) => right.has(token)).length;
  const unionSize = new Set([...left, ...right]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function containsToken(value: string, token: string): boolean {
  return tokens(value).has(token);
}

function containsContextIndicator(report: NormalizedReport): boolean {
  const reportTokens = tokens(report.descriptionRaw);
  return (
    contextIndicators.some((indicator) => reportTokens.has(indicator)) ||
    followUpConcepts.some((concept) => concept.some((form) => reportTokens.has(form)))
  );
}

function isExplicitFollowUp(report: NormalizedReport): boolean {
  const reportTokens = tokens(report.descriptionRaw);
  return followUpConcepts.some((concept) =>
    concept.some((form) => reportTokens.has(form)),
  );
}

function findContradiction(
  currentReport: NormalizedReport,
  candidate: CandidateIncident,
): CorrelationConflictSignal | null {
  for (const previousReport of candidate.reports) {
    for (const [left, right] of contradictionPairs) {
      const currentHasLeft = containsToken(currentReport.descriptionRaw, left);
      const currentHasRight = containsToken(currentReport.descriptionRaw, right);
      const previousHasLeft = containsToken(previousReport.descriptionRaw, left);
      const previousHasRight = containsToken(previousReport.descriptionRaw, right);

      if (
        (currentHasLeft && previousHasRight) ||
        (currentHasRight && previousHasLeft)
      ) {
        return {
          type: "CONTRADICTORY_EVIDENCE",
          reportIds: [currentReport.report_id, previousReport.report_id],
          incidentId: candidate.incidentId,
          reason: `Reports provide contradictory evidence: ${left} versus ${right}`,
        };
      }
    }
  }

  return null;
}

function scoreCandidate(
  report: NormalizedReport,
  candidate: CandidateIncident,
): CandidateIncidentScore {
  const locationSimilarity = jaccardSimilarity(
    tokens(report.locationNormalized),
    tokens(candidate.locationNormalized),
  );
  const categoryScore =
    report.categoryNormalized === candidate.categoryNormalized || isExplicitFollowUp(report)
      ? 1
      : 0;
  const descriptionScore = Math.max(
    ...candidate.reports.map((previousReport) =>
      jaccardSimilarity(tokens(report.descriptionRaw), tokens(previousReport.descriptionRaw)),
    ),
    0,
  );
  const contextScore =
    candidate.reports.some((previousReport) => containsContextIndicator(previousReport)) ||
    containsContextIndicator(report)
      ? 1
      : 0;
  const activityScore = report.processingOrder > candidate.lastProcessingOrder ? 1 : 0;

  const components: readonly CorrelationComponentScore[] = [
    {
      name: "location",
      score: roundScore(locationSimilarity),
      weight: CORRELATION_CONFIG.weights.location,
      weightedScore: roundScore(locationSimilarity * CORRELATION_CONFIG.weights.location),
      reason:
        locationSimilarity === 1
          ? "Same normalized location"
          : locationSimilarity > 0
            ? "Partially matching normalized location"
            : "Different normalized location",
    },
    {
      name: "category",
      score: categoryScore,
      weight: CORRELATION_CONFIG.weights.category,
      weightedScore: roundScore(categoryScore * CORRELATION_CONFIG.weights.category),
      reason:
        categoryScore === 1
          ? report.categoryNormalized === candidate.categoryNormalized
            ? "Same normalized category"
            : "Explicit follow-up evidence is compatible despite category change"
          : "Different normalized category; category mismatch is not treated as an automatic exclusion",
    },
    {
      name: "description",
      score: roundScore(descriptionScore),
      weight: CORRELATION_CONFIG.weights.description,
      weightedScore: roundScore(descriptionScore * CORRELATION_CONFIG.weights.description),
      reason:
        descriptionScore > 0
          ? "Description tokens overlap with existing incident evidence"
          : "No meaningful description token overlap",
    },
    {
      name: "context",
      score: contextScore,
      weight: CORRELATION_CONFIG.weights.context,
      weightedScore: roundScore(contextScore * CORRELATION_CONFIG.weights.context),
      reason:
        contextScore === 1
          ? "Follow-up or operational context supports the same incident"
          : "No supporting follow-up or operational context",
    },
    {
      name: "activity",
      score: activityScore,
      weight: CORRELATION_CONFIG.weights.activity,
      weightedScore: roundScore(activityScore * CORRELATION_CONFIG.weights.activity),
      reason:
        activityScore === 1
          ? "Incident has recent prior activity in processing order"
          : "Incident has no recent prior activity in processing order",
    },
  ];

  const totalScore = roundScore(
    components.reduce((total, component) => total + component.weightedScore, 0),
  );

  return {
    candidate,
    evidence: {
      components,
      totalScore,
      reasons: components.filter((component) => component.score > 0).map((component) => component.reason),
    },
  };
}

function emptyEvidence(): CorrelationEvidence {
  return { components: [], totalScore: 0, reasons: [] };
}

function noReview(): HumanReviewRequirement {
  return { required: false, reason: null, candidateIncidentIds: [] };
}

function duplicateResult(
  report: NormalizedReport,
  original: { report: NormalizedReport; incidentId: string | null },
): CorrelationResult {
  const duplicate: DuplicateInformation = {
    originalReportId: original.report.report_id,
    originalIncidentId: original.incidentId,
    reason: "The report ID matches an already processed report",
  };

  return {
    reportId: report.report_id,
    decision: "DUPLICATE_REPORT",
    matchStatus: "MATCHED",
    incidentId: original.incidentId,
    confidence: 1,
    evidence: emptyEvidence(),
    candidateScores: [],
    duplicate,
    humanReview: noReview(),
    conflict: null,
  };
}

export function createCorrelationState(): CorrelationState {
  return { processedReports: [], incidents: [] };
}

export function correlateReport(
  report: NormalizedReport,
  state: CorrelationState,
): CorrelationResult {
  const original = state.processedReports.find(
    (processedReport) => processedReport.report.report_id === report.report_id,
  );
  if (original) {
    return duplicateResult(report, original);
  }

    if (isDeclaredDuplicate(report)) {
    const declaredOriginal = state.processedReports.find(
      (processedReport) =>
        processedReport.duplicateOfReportId === null &&
        processedReport.report.locationNormalized === report.locationNormalized &&
        processedReport.report.categoryNormalized === report.categoryNormalized,
    );
    if (declaredOriginal) {
      return duplicateResult(report, declaredOriginal);
    }
  }

  const candidateScores = state.incidents
    .map((candidate) => scoreCandidate(report, candidate))
    .sort((left, right) => {
      const scoreDifference = right.evidence.totalScore - left.evidence.totalScore;
      return scoreDifference === 0
        ? left.candidate.incidentId.localeCompare(right.candidate.incidentId)
        : scoreDifference;
    });
  const bestCandidate = candidateScores[0];

  if (!bestCandidate || bestCandidate.evidence.totalScore < CORRELATION_CONFIG.thresholds.ambiguous) {
    return {
      reportId: report.report_id,
      decision: "NEW_INCIDENT",
      matchStatus: "NO_MATCH",
      incidentId: null,
      confidence: bestCandidate?.evidence.totalScore ?? 0,
      evidence: bestCandidate?.evidence ?? emptyEvidence(),
      candidateScores,
      duplicate: null,
      humanReview: noReview(),
      conflict: null,
    };
  }

  const isAmbiguous =
    bestCandidate.evidence.totalScore < CORRELATION_CONFIG.thresholds.existingIncident;
  const conflict = findContradiction(report, bestCandidate.candidate);
  const humanReview: HumanReviewRequirement = isAmbiguous
    ? {
        required: true,
        reason: "Correlation score is in the ambiguous range and requires human review",
        candidateIncidentIds: candidateScores
          .filter((candidate) => candidate.evidence.totalScore >= CORRELATION_CONFIG.thresholds.ambiguous)
          .map((candidate) => candidate.candidate.incidentId),
      }
    : noReview();

  return {
    reportId: report.report_id,
    decision: "EXISTING_INCIDENT",
    matchStatus: isAmbiguous ? "AMBIGUOUS" : "MATCHED",
    incidentId: bestCandidate.candidate.incidentId,
    confidence: bestCandidate.evidence.totalScore,
    evidence: bestCandidate.evidence,
    candidateScores,
    duplicate: null,
    humanReview,
    conflict,
  };
}

function addReportToIncident(
  candidate: CandidateIncident,
  report: NormalizedReport,
): CandidateIncident {
  return {
    ...candidate,
    reportIds: [...candidate.reportIds, report.report_id],
    reports: [...candidate.reports, report],
    lastProcessingOrder: report.processingOrder,
  };
}

export function applyCorrelationResult(
  report: NormalizedReport,
  state: CorrelationState,
  result: CorrelationResult,
): CorrelationState {
  const processedReport: ProcessedCorrelationReport = {
    report,
    incidentId: result.incidentId,
    duplicateOfReportId: result.duplicate?.originalReportId ?? null,
    candidateIncidentIds: result.humanReview.candidateIncidentIds,
  };

  if (result.decision === "DUPLICATE_REPORT") {
    return {
      ...state,
      processedReports: [...state.processedReports, processedReport],
    };
  }

  if (result.decision === "NEW_INCIDENT") {
    const incident: CandidateIncident = {
      incidentId: `incident-${report.report_id}`,
      locationNormalized: report.locationNormalized,
      categoryNormalized: report.categoryNormalized,
      reportIds: [report.report_id],
      reports: [report],
      lastProcessingOrder: report.processingOrder,
    };

    return {
      processedReports: [...state.processedReports, { ...processedReport, incidentId: incident.incidentId }],
      incidents: [...state.incidents, incident],
    };
  }

    if (result.matchStatus === "AMBIGUOUS") {
    // Ambiguous matches are still reported to the incident. The
    // humanReview flag on the correlation result is what signals
    // uncertainty; refusing to attach the report would orphan it.
    const incidents = state.incidents.map((candidate) =>
      candidate.incidentId === result.incidentId
        ? addReportToIncident(candidate, report)
        : candidate,
    );

    return {
      processedReports: [...state.processedReports, processedReport],
      incidents,
    };
  }

  const incidents = state.incidents.map((candidate) =>
    candidate.incidentId === result.incidentId ? addReportToIncident(candidate, report) : candidate,
  );

  return {
    processedReports: [...state.processedReports, processedReport],
    incidents,
  };
}

export function processCorrelatedReport(
  report: NormalizedReport,
  state: CorrelationState,
): CorrelationProcessingResult {
  const result = correlateReport(report, state);
  return { result, state: applyCorrelationResult(report, state, result) };
}