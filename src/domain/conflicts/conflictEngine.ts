import type { NormalizedReport } from "@/types/report";
import type {
  ConflictInput,
  ConflictProcessingResult,
  ConflictRecord,
  ConflictResult,
  ConflictSignal,
  ConflictState,
  ConflictType,
} from "./types";

const severityRank: Readonly<Record<string, number>> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const conflictConfidence = {
  severity: 0.95,
  factual: 0.9,
  state: 0.85,
  location: 0.7,
  category: 0.65,
} as const;

const categoryContradictions = new Set([
  "FIRE|NETWORK_OUTAGE",
  "LIFT|NETWORK_OUTAGE",
]);

const stopWords = new Set(["a", "an", "and", "are", "is", "of", "on", "the", "to"]);

function tokens(value: string): ReadonlySet<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}-]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stopWords.has(token)),
  );
}

function wordTokens(value: string): readonly string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hasToken(report: NormalizedReport, token: string): boolean {
  return tokens(report.descriptionRaw).has(token);
}

function hasAnyToken(report: NormalizedReport, values: readonly string[]): boolean {
  const reportTokens = tokens(report.descriptionRaw);
  return values.some((value) => reportTokens.has(value));
}

function hasNegatedConcept(report: NormalizedReport, concept: readonly string[]): boolean {
  const reportTokens = wordTokens(report.descriptionRaw);
  const firstConceptIndex = reportTokens.indexOf(concept[0]);
  if (firstConceptIndex < 0 || !concept.every((token) => reportTokens.includes(token))) {
    return false;
  }

  const negationTokens = new Set(["no", "not", "nobody", "without"]);
  return reportTokens
    .slice(Math.max(0, firstConceptIndex - 2), firstConceptIndex)
    .some((token) => negationTokens.has(token));
}

function hasPositiveConcept(report: NormalizedReport, concept: readonly string[]): boolean {
  return concept.every((token) => hasToken(report, token)) && !hasNegatedConcept(report, concept);
}

function isControlReport(report: NormalizedReport): boolean {
  return hasAnyToken(report, [
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
    "isolated",
  ]);
}

function isLegitimateControlForConcept(
  current: NormalizedReport,
  concept: readonly string[],
): boolean {
  if (concept.includes("trapped")) {
    return hasToken(current, "released");
  }
  if (concept.includes("sparks")) {
    return hasNegatedConcept(current, ["sparks"]) && hasToken(current, "isolated");
  }
  return false;
}

function locationOverlap(left: string, right: string): boolean {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  return [...leftTokens].some((token) => rightTokens.has(token));
}

function categoryPairKey(left: string, right: string): string {
  return [left, right].sort().join("|");
}

function signal(
  type: ConflictType,
  earlier: NormalizedReport,
  current: NormalizedReport,
  confidence: number,
  explanation: string,
): ConflictSignal {
  return {
    type,
    reportIds: [earlier.report_id, current.report_id],
    confidence,
    explanation: `${type} between reports ${earlier.report_id} and ${current.report_id}: ${explanation}`,
    requiresHumanReview: true,
  };
}

function findFactualSignals(
  earlier: NormalizedReport,
  current: NormalizedReport,
): ConflictSignal[] {
  const concepts = [
    { terms: ["fire"], label: "fire" },
    { terms: ["smoke"], label: "smoke" },
    { terms: ["sparks"], label: "electrical sparks" },
    { terms: ["person", "trapped"], label: "a person trapped" },
    { terms: ["trapped"], label: "trapped" },
  ] as const;
  const signals: ConflictSignal[] = [];

  for (const concept of concepts) {
    if (isLegitimateControlForConcept(current, concept.terms)) {
      continue;
    }
    if (
      (hasPositiveConcept(earlier, concept.terms) && hasNegatedConcept(current, concept.terms)) ||
      (hasNegatedConcept(earlier, concept.terms) && hasPositiveConcept(current, concept.terms))
    ) {
      signals.push(
        signal(
          "FACTUAL_CONTRADICTION",
          earlier,
          current,
          conflictConfidence.factual,
          `one report asserts ${concept.label} while the other negates it`,
        ),
      );
    }
  }

  return signals;
}

function findStateSignal(
  earlier: NormalizedReport,
  current: NormalizedReport,
): ConflictSignal | null {
  const earlierActive =
    hasPositiveConcept(earlier, ["trapped"]) ||
    hasPositiveConcept(earlier, ["fire", "spreading"]) ||
    hasPositiveConcept(earlier, ["sparks", "continuing"]);
  const currentNormal = hasAnyToken(current, ["operating", "normally", "repaired"]);

  if (!earlierActive || !currentNormal) {
    return null;
  }

  const directlyResolved =
    (hasPositiveConcept(earlier, ["trapped"]) && hasAnyToken(current, ["released"])) ||
    (hasPositiveConcept(earlier, ["sparks", "continuing"]) &&
      hasNegatedConcept(current, ["sparks"]) &&
      hasToken(current, "isolated"));

  return directlyResolved
    ? null
    : signal(
        "STATE_CONTRADICTION",
        earlier,
        current,
        conflictConfidence.state,
        "active danger evidence conflicts with a later normal-operation or repair claim",
      );
}

function findLocationSignal(
  earlier: NormalizedReport,
  current: NormalizedReport,
): ConflictSignal | null {
  if (
    earlier.locationNormalized.length === 0 ||
    current.locationNormalized.length === 0 ||
    locationOverlap(earlier.locationNormalized, current.locationNormalized)
  ) {
    return null;
  }

  return signal(
    "LOCATION_CONTRADICTION",
    earlier,
    current,
    conflictConfidence.location,
    "materially different normalized locations were reported for the same incident",
  );
}

function findCategorySignal(
  earlier: NormalizedReport,
  current: NormalizedReport,
): ConflictSignal | null {
  if (
    earlier.categoryNormalized === current.categoryNormalized ||
    !categoryContradictions.has(
      categoryPairKey(earlier.categoryNormalized, current.categoryNormalized),
    )
  ) {
    return null;
  }

  return signal(
    "CATEGORY_CONTRADICTION",
    earlier,
    current,
    conflictConfidence.category,
    "materially incompatible categories were reported for the same incident",
  );
}

function findSeveritySignal(
  earlier: NormalizedReport,
  current: NormalizedReport,
): ConflictSignal | null {
  const earlierLevel = severityRank[earlier.reportedSeverityNormalized] ?? 0;
  const currentLevel = severityRank[current.reportedSeverityNormalized] ?? 0;
  if (currentLevel >= earlierLevel || isControlReport(current)) {
    return null;
  }

  return signal(
    "SEVERITY_CONTRADICTION",
    earlier,
    current,
    conflictConfidence.severity,
    "later lower reported severity conflicts with earlier severity evidence",
  );
}

function noConflict(incidentId: string | null): ConflictResult {
  return {
    conflictExists: false,
    conflictId: null,
    duplicateOfConflictId: null,
    conflictType: null,
    incidentId,
    involvedReportIds: [],
    evidenceReports: [],
    signals: [],
    confidence: 0,
    explanation: "No contradictory evidence was detected.",
    requiresHumanReview: false,
    status: null,
    isDuplicate: false,
  };
}

function conflictIdFor(incidentId: string, signals: readonly ConflictSignal[]): string {
  const reportIds = [...new Set(signals.flatMap((item) => item.reportIds))].sort().join("-");
  return `conflict-${incidentId}-${signals[0]?.type ?? "UNKNOWN"}-${reportIds}`;
}

export function createConflictState(): ConflictState {
  return { records: [] };
}

export function detectConflicts(input: ConflictInput): ConflictResult {
  if (
    input.correlationResult.decision !== "EXISTING_INCIDENT" ||
    input.correlationResult.matchStatus !== "MATCHED" ||
    input.incidentId === null ||
    input.reports.length < 2
  ) {
    return noConflict(input.incidentId);
  }

  const signals: ConflictSignal[] = [];
  if (input.severityAssessment?.conflict) {
    const severityConflict = input.severityAssessment.conflict;
    const earlier = input.reports.find((report) => report.report_id === severityConflict.reportIds[0]);
    const current = input.reports.find((report) => report.report_id === severityConflict.reportIds[1]);
    if (earlier && current) {
      signals.push(
        signal(
          "SEVERITY_CONTRADICTION",
          earlier,
          current,
          conflictConfidence.severity,
          severityConflict.reason,
        ),
      );
    }
  }

  for (let index = 1; index < input.reports.length; index += 1) {
    const earlier = input.reports[index - 1];
    const current = input.reports[index];
    signals.push(...findFactualSignals(earlier, current));
    const stateSignal = findStateSignal(earlier, current);
    const locationSignal = findLocationSignal(earlier, current);
    const categorySignal = findCategorySignal(earlier, current);
    const severitySignal = findSeveritySignal(earlier, current);
    if (stateSignal) signals.push(stateSignal);
    if (locationSignal) signals.push(locationSignal);
    if (categorySignal) signals.push(categorySignal);
    if (severitySignal) signals.push(severitySignal);
  }

  if (signals.length === 0) {
    return noConflict(input.incidentId);
  }

  const orderedSignals = [...signals].sort((left, right) => right.confidence - left.confidence);
  const involvedReportIds = [...new Set(orderedSignals.flatMap((item) => item.reportIds))];
  const evidenceReports = input.reports.filter((report) => involvedReportIds.includes(report.report_id));
  const conflictType = orderedSignals[0].type;
  return {
    conflictExists: true,
    conflictId: conflictIdFor(input.incidentId, orderedSignals),
    duplicateOfConflictId: null,
    conflictType,
    incidentId: input.incidentId,
    involvedReportIds,
    evidenceReports,
    signals: orderedSignals,
    confidence: orderedSignals[0].confidence,
    explanation: orderedSignals.map((item) => item.explanation).join(" "),
    requiresHumanReview: true,
    status: "UNDER_REVIEW",
    isDuplicate: false,
  };
}

export function processConflict(
  input: ConflictInput,
  state: ConflictState,
): ConflictProcessingResult {
  const result = detectConflicts(input);
  if (!result.conflictExists || result.conflictId === null) {
    return { result, state };
  }

  const existing = state.records.find((record) => record.conflictId === result.conflictId);
  if (existing) {
    return {
      result: {
        ...result,
        duplicateOfConflictId: existing.conflictId,
        isDuplicate: true,
      },
      state,
    };
  }

  const record: ConflictRecord = {
    conflictId: result.conflictId,
    result,
    createdAt: input.assessedAt,
  };
  return {
    result,
    state: { records: [...state.records, record] },
  };
}