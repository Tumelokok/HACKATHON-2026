import type {
  IncidentState,
  LifecycleEvidence,
  LifecycleProcessingResult,
  LifecycleRecord,
  LifecycleState,
  LifecycleTransitionEntry,
  LifecycleTransitionRequest,
  LifecycleTransitionResult,
} from "./types";

export const VALID_TRANSITIONS: Readonly<Record<IncidentState, readonly IncidentState[]>> = {
  CREATED: ["ASSESSING", "CANCELLED"],
  ASSESSING: ["ACTIVE", "RESPONDING", "ESCALATED", "CANCELLED"],
  ACTIVE: ["RESPONDING", "ESCALATED", "MONITORING", "RESOLVED"],
  RESPONDING: ["MONITORING", "ESCALATED", "RESOLVED"],
  MONITORING: ["ACTIVE", "RESPONDING", "ESCALATED", "RESOLVED"],
  ESCALATED: ["RESPONDING", "MONITORING", "RESOLVED"],
  RESOLVED: ["ACTIVE", "ESCALATED"],
  CANCELLED: [],
};

const resolutionPhrases = [
  ["repaired", "tested"],
  ["repair", "tested"],
  ["released", "tested"],
  ["removed", "tested"],
  ["power", "isolated", "hazard", "removed"],
  ["fire", "extinguished", "inspected"],
  ["incident", "confirmed", "resolved"],
  ["restored", "tested"],
  // A report that declares the incident "resolved" or "controlled" is
  // explicitly signalling that the immediate danger has ended. This is
  // the resolution convention used by the development corpus.
  ["resolved"],
  ["controlled"],
] as const;

const escalationIndicators = [
  "immediate",
  "danger",
  "trapped",
  "critical",
  "worsening",
  "evacuation",
  "injury",
  "multiple",
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

function hasPhrase(value: string, phrase: readonly string[]): boolean {
  const valueTokens = tokens(value);
  return phrase.every((token) => valueTokens.has(token));
}

function hasResolutionEvidence(evidence: LifecycleEvidence): boolean {
  return evidence.reports.some((report) =>
    resolutionPhrases.some((phrase) => hasPhrase(report.descriptionRaw, phrase)),
  );
}

function hasEscalationEvidence(evidence: LifecycleEvidence): boolean {
  if (
    evidence.severityAssessment?.level === "HIGH" ||
    evidence.severityAssessment?.level === "CRITICAL" ||
    evidence.conflictResult?.requiresHumanReview === true
  ) {
    return true;
  }

  return evidence.reports.some((report) => {
    const reportTokens = tokens(report.descriptionRaw);
    return escalationIndicators.some((indicator) => reportTokens.has(indicator));
  });
}

function hasConfirmedCorrelation(evidence: LifecycleEvidence): boolean {
  return (
    evidence.correlationResult.matchStatus !== "AMBIGUOUS" &&
    evidence.correlationResult.decision !== "DUPLICATE_REPORT"
  );
}

function hasMaterialEvidence(evidence: LifecycleEvidence): boolean {
  return evidence.reports.length > 0 && hasConfirmedCorrelation(evidence);
}

function transitionIdFor(request: LifecycleTransitionRequest, sequence: number): string {
  return `transition-${request.incidentId}-${sequence}-${request.fromState}-${request.requestedState}`;
}

function evidenceReportIds(evidence: LifecycleEvidence): readonly string[] {
  return evidence.reports.map((report) => report.report_id);
}

function rejected(
  request: LifecycleTransitionRequest,
  reason: string,
  requiresHumanReview = false,
): LifecycleTransitionResult {
  return {
    accepted: false,
    fromState: request.fromState,
    requestedState: request.requestedState,
    resultingState: request.fromState,
    reason,
    triggeringReportId: request.triggeringReportId ?? null,
    actor: request.actor,
    requiresHumanReview,
    transitionId: null,
    evidenceReportIds: evidenceReportIds(request.evidence),
    transition: null,
  };
}

export function createLifecycleState(): LifecycleState {
  return { records: [] };
}

export function ensureIncidentLifecycle(
  state: LifecycleState,
  incidentId: string,
): LifecycleState {
  if (state.records.some((record) => record.incidentId === incidentId)) {
    return state;
  }

  const record: LifecycleRecord = {
    incidentId,
    currentState: "CREATED",
    history: [],
  };
  return { records: [...state.records, record] };
}

export function transitionIncident(
  request: LifecycleTransitionRequest,
  record: LifecycleRecord,
): LifecycleTransitionResult {
  if (request.incidentId !== record.incidentId) {
    return rejected(request, "The transition incident does not match the lifecycle record.");
  }

  if (request.fromState !== record.currentState) {
    return rejected(
      request,
      `Transition expected current state ${record.currentState}, received ${request.fromState}.`,
    );
  }

  if (!VALID_TRANSITIONS[request.fromState].includes(request.requestedState)) {
    return rejected(
      request,
      `${request.fromState} cannot transition automatically to ${request.requestedState}.`,
      request.fromState === "CANCELLED" || request.requestedState === "RESOLVED",
    );
  }

  if (!request.reason.trim()) {
    return rejected(request, "A concise transition reason is required.");
  }

  if (!hasMaterialEvidence(request.evidence)) {
    return rejected(
      request,
      "A lifecycle transition requires confirmed incident evidence; duplicates and ambiguous correlation cannot mutate state.",
      true,
    );
  }

  if (request.requestedState === "RESOLVED") {
    if (request.evidence.conflictResult?.requiresHumanReview === true) {
      return rejected(
        request,
        "An unresolved safety-relevant conflict requires human review before resolution.",
        true,
      );
    }
    if (!hasResolutionEvidence(request.evidence)) {
      return rejected(
        request,
        "Credible repair, control, testing, inspection, or resolution evidence is required.",
        true,
      );
    }
  }

  if (request.requestedState === "ESCALATED" && !hasEscalationEvidence(request.evidence)) {
    return rejected(
      request,
      "Escalation requires severe, dangerous, worsening, or unresolved contradictory evidence.",
      true,
    );
  }

  const sequence = record.history.length + 1;
  const transitionId = transitionIdFor(request, sequence);
  const transition: LifecycleTransitionEntry = {
    transitionId,
    incidentId: request.incidentId,
    fromState: request.fromState,
    toState: request.requestedState,
    reason: request.reason.trim(),
    triggeringReportId: request.triggeringReportId ?? null,
    actor: request.actor,
    sequence,
    createdAt: request.requestedAt,
    evidenceReportIds: evidenceReportIds(request.evidence),
  };

  return {
    accepted: true,
    fromState: request.fromState,
    requestedState: request.requestedState,
    resultingState: request.requestedState,
    reason: transition.reason,
    triggeringReportId: transition.triggeringReportId,
    actor: request.actor,
    requiresHumanReview: request.evidence.conflictResult?.requiresHumanReview === true,
    transitionId,
    evidenceReportIds: transition.evidenceReportIds,
    transition,
  };
}

export function processLifecycleTransition(
  request: LifecycleTransitionRequest,
  state: LifecycleState,
): LifecycleProcessingResult {
  const record = state.records.find((item) => item.incidentId === request.incidentId);
  if (!record) {
    return {
      result: rejected(request, "No lifecycle record exists for this incident."),
      state,
    };
  }

  const result = transitionIncident(request, record);
  if (!result.accepted || result.transition === null) {
    return { result, state };
  }

  const records = state.records.map((item) =>
    item.incidentId === request.incidentId
      ? {
          ...item,
          currentState: result.resultingState,
          history: [...item.history, result.transition],
        }
      : item,
  );
  return { result, state: { records } };
}