import { describe, expect, it } from "vitest";

import type { CorrelationResult } from "../../src/domain/correlation";
import {
  createLifecycleState,
  ensureIncidentLifecycle,
  processLifecycleTransition,
  transitionIncident,
} from "../../src/domain/lifecycle";
import type {
  IncidentState,
  LifecycleEvidence,
  LifecycleRecord,
  LifecycleTransitionRequest,
} from "../../src/domain/lifecycle";
import { processReport } from "../../src/domain/processing/reportProcessing";
import type { RawReportInput } from "../../src/types/report";

const baseInput: RawReportInput = {
  report_id: "R-001",
  timestamp: "2026-09-20T10:00:00Z",
  location: "Library Level 2",
  category: "Other",
  reported_severity: "low",
  description: "A minor issue is reported.",
  reporter_type: "student",
};

function report(
  overrides: Partial<RawReportInput> = {},
  processingOrder = 0,
) {
  return processReport({ ...baseInput, ...overrides }, processingOrder).normalizedReport;
}

function correlation(
  reportId = "R-001",
  decision: CorrelationResult["decision"] = "EXISTING_INCIDENT",
  matchStatus: CorrelationResult["matchStatus"] = "MATCHED",
): CorrelationResult {
  return {
    reportId,
    decision,
    matchStatus,
    incidentId: "incident-R-001",
    confidence: 1,
    evidence: { components: [], totalScore: 1, reasons: [] },
    candidateScores: [],
    duplicate: null,
    humanReview: { required: matchStatus === "AMBIGUOUS", reason: null, candidateIncidentIds: [] },
    conflict: null,
  };
}

function evidence(
  reports: ReturnType<typeof report>[] = [report()],
  options: {
    correlation?: CorrelationResult;
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    conflictReview?: boolean;
  } = {},
): LifecycleEvidence {
  return {
    reports,
    correlationResult: options.correlation ?? correlation(reports.at(-1)?.report_id),
    severityAssessment: options.severity
      ? {
          incidentId: "incident-R-001",
          level: options.severity,
          confidence: 0.9,
          reason: "Test evidence",
          evidenceReportIds: reports.map((item) => item.report_id),
          source: "RULE_ENGINE",
          createdAt: "2026-09-20T10:00:00Z",
          conflict: null,
          requiresHumanReview: false,
        }
      : null,
    conflictResult: options.conflictReview
      ? {
          conflictExists: true,
          conflictId: "conflict-1",
          duplicateOfConflictId: null,
          conflictType: "FACTUAL_CONTRADICTION",
          incidentId: "incident-R-001",
          involvedReportIds: reports.map((item) => item.report_id),
          evidenceReports: reports,
          signals: [],
          confidence: 0.9,
          explanation: "Conflicting safety evidence",
          requiresHumanReview: true,
          status: "UNDER_REVIEW",
          isDuplicate: false,
        }
      : null,
  };
}

function record(state: IncidentState): LifecycleRecord {
  return { incidentId: "incident-R-001", currentState: state, history: [] };
}

function request(
  fromState: IncidentState,
  requestedState: IncidentState,
  options: {
    evidence?: LifecycleEvidence;
    reason?: string;
    reportId?: string;
    actor?: "RULE_ENGINE" | "APPLICATION" | "HUMAN";
  } = {},
): LifecycleTransitionRequest {
  return {
    incidentId: "incident-R-001",
    fromState,
    requestedState,
    reason: options.reason ?? `Move incident to ${requestedState}`,
    triggeringReportId: options.reportId ?? "R-001",
    actor: options.actor ?? "RULE_ENGINE",
    requestedAt: "2026-09-20T10:00:00Z",
    evidence: options.evidence ?? evidence(),
  };
}

describe("incident lifecycle state machine", () => {
  it("creates new incidents in CREATED", () => {
    const state = ensureIncidentLifecycle(createLifecycleState(), "incident-R-001");

    expect(state.records[0]?.currentState).toBe("CREATED");
    expect(state.records[0]?.history).toEqual([]);
  });

  it("accepts CREATED to ASSESSING", () => {
    expect(transitionIncident(request("CREATED", "ASSESSING"), record("CREATED")).accepted).toBe(true);
  });

  it("accepts CREATED to CANCELLED", () => {
    expect(transitionIncident(request("CREATED", "CANCELLED"), record("CREATED")).accepted).toBe(true);
  });

  it("rejects CREATED to ACTIVE", () => {
    const result = transitionIncident(request("CREATED", "ACTIVE"), record("CREATED"));
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("cannot transition");
  });

  it("rejects CREATED to RESOLVED", () => {
    expect(transitionIncident(request("CREATED", "RESOLVED"), record("CREATED")).accepted).toBe(false);
  });

  it("accepts ASSESSING to ACTIVE", () => {
    expect(transitionIncident(request("ASSESSING", "ACTIVE"), record("ASSESSING")).accepted).toBe(true);
  });

  it("accepts ASSESSING to RESPONDING", () => {
    expect(transitionIncident(request("ASSESSING", "RESPONDING"), record("ASSESSING")).accepted).toBe(true);
  });

  it("accepts ASSESSING to ESCALATED with danger evidence", () => {
    const result = transitionIncident(
      request("ASSESSING", "ESCALATED", { evidence: evidence([report({ description: "Immediate danger is reported." })], { severity: "HIGH" }) }),
      record("ASSESSING"),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts ACTIVE to RESPONDING", () => {
    expect(transitionIncident(request("ACTIVE", "RESPONDING"), record("ACTIVE")).accepted).toBe(true);
  });

  it("accepts ACTIVE to ESCALATED", () => {
    const result = transitionIncident(
      request("ACTIVE", "ESCALATED", { evidence: evidence([report({ description: "Person is trapped." })], { severity: "HIGH" }) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts ACTIVE to MONITORING", () => {
    expect(transitionIncident(request("ACTIVE", "MONITORING"), record("ACTIVE")).accepted).toBe(true);
  });

  it("accepts ACTIVE to RESOLVED with credible resolution evidence", () => {
    const result = transitionIncident(
      request("ACTIVE", "RESOLVED", {
        evidence: evidence([report({ description: "Technician repaired the panel and tested it." })]),
      }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(true);
  });

  it("rejects ACTIVE to RESOLVED without credible evidence", () => {
    const result = transitionIncident(
      request("ACTIVE", "RESOLVED", { evidence: evidence([report({ description: "Seems okay." })], { severity: "HIGH" }) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(false);
    expect(result.requiresHumanReview).toBe(true);
  });

  it("accepts RESPONDING to MONITORING", () => {
    expect(transitionIncident(request("RESPONDING", "MONITORING"), record("RESPONDING")).accepted).toBe(true);
  });

  it("accepts RESPONDING to RESOLVED with credible evidence", () => {
    const result = transitionIncident(
      request("RESPONDING", "RESOLVED", { evidence: evidence([report({ description: "Power isolated, hazard removed, and panel tested." })]) }),
      record("RESPONDING"),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts MONITORING to ACTIVE", () => {
    expect(transitionIncident(request("MONITORING", "ACTIVE"), record("MONITORING")).accepted).toBe(true);
  });

  it("accepts MONITORING to RESPONDING", () => {
    expect(transitionIncident(request("MONITORING", "RESPONDING"), record("MONITORING")).accepted).toBe(true);
  });

  it("accepts MONITORING to ESCALATED with danger evidence", () => {
    const result = transitionIncident(
      request("MONITORING", "ESCALATED", { evidence: evidence([report({ description: "The hazard is worsening." })], { severity: "HIGH" }) }),
      record("MONITORING"),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts MONITORING to RESOLVED with credible evidence", () => {
    const result = transitionIncident(
      request("MONITORING", "RESOLVED", { evidence: evidence([report({ description: "Incident confirmed resolved after inspection." })]) }),
      record("MONITORING"),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts ESCALATED to RESPONDING", () => {
    expect(transitionIncident(request("ESCALATED", "RESPONDING"), record("ESCALATED")).accepted).toBe(true);
  });

  it("accepts ESCALATED to MONITORING", () => {
    expect(transitionIncident(request("ESCALATED", "MONITORING"), record("ESCALATED")).accepted).toBe(true);
  });

  it("accepts ESCALATED to RESOLVED with credible evidence", () => {
    const result = transitionIncident(
      request("ESCALATED", "RESOLVED", { evidence: evidence([report({ description: "Fire extinguished and area inspected." })]) }),
      record("ESCALATED"),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts RESOLVED to ACTIVE for renewed danger", () => {
    const result = transitionIncident(
      request("RESOLVED", "ACTIVE", { evidence: evidence([report({ description: "Person is trapped again." })], { severity: "HIGH" }) }),
      record("RESOLVED"),
    );
    expect(result.accepted).toBe(true);
  });

  it("accepts RESOLVED to ESCALATED for renewed severe danger", () => {
    const result = transitionIncident(
      request("RESOLVED", "ESCALATED", { evidence: evidence([report({ description: "Immediate danger is reported again." })], { severity: "CRITICAL" }) }),
      record("RESOLVED"),
    );
    expect(result.accepted).toBe(true);
  });

  it("rejects RESOLVED to MONITORING", () => {
    expect(transitionIncident(request("RESOLVED", "MONITORING"), record("RESOLVED")).accepted).toBe(false);
  });

  it("rejects CANCELLED to ACTIVE", () => {
    expect(transitionIncident(request("CANCELLED", "ACTIVE"), record("CANCELLED")).accepted).toBe(false);
  });

  it("rejects CANCELLED to RESOLVED", () => {
    expect(transitionIncident(request("CANCELLED", "RESOLVED"), record("CANCELLED")).accepted).toBe(false);
  });

  it("does not transition for duplicate correlation", () => {
    const result = transitionIncident(
      request("ACTIVE", "RESPONDING", { evidence: evidence([report()], { correlation: correlation("R-001", "DUPLICATE_REPORT", "MATCHED") }) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(false);
    expect(result.requiresHumanReview).toBe(true);
  });

  it("does not transition for ambiguous correlation", () => {
    const result = transitionIncident(
      request("ACTIVE", "RESPONDING", { evidence: evidence([report()], { correlation: correlation("R-001", "EXISTING_INCIDENT", "AMBIGUOUS") }) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(false);
  });

  it("does not break on malformed timestamps", () => {
    const result = transitionIncident(
      request("CREATED", "ASSESSING", { evidence: evidence([report({ timestamp: "not-a-timestamp" })]) }),
      record("CREATED"),
    );
    expect(result.accepted).toBe(true);
  });

  it("does not resolve high danger without resolution evidence", () => {
    const result = transitionIncident(
      request("ACTIVE", "RESOLVED", { evidence: evidence([report({ description: "Fire spreading rapidly." })], { severity: "CRITICAL" }) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(false);
  });

  it("accepts escalation for a strong unresolved conflict and requests review", () => {
    const result = transitionIncident(
      request("ACTIVE", "ESCALATED", { evidence: evidence([report()], { conflictReview: true }) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(true);
    expect(result.requiresHumanReview).toBe(true);
  });

  it("allows normal control evidence to move RESPONDING to MONITORING", () => {
    const result = transitionIncident(
      request("RESPONDING", "MONITORING", { evidence: evidence([report({ description: "Power isolated; technician is monitoring." })]) }),
      record("RESPONDING"),
    );
    expect(result.accepted).toBe(true);
  });

  it("requires explicit repair or test evidence for resolution", () => {
    const result = transitionIncident(
      request("ACTIVE", "RESOLVED", { evidence: evidence([report({ description: "Technician repaired the electrical panel and tested it." })]) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(true);
    expect(result.evidenceReportIds).toEqual(["R-001"]);
  });

  it("rejects weak seems-okay evidence for a serious incident", () => {
    const result = transitionIncident(
      request("ACTIVE", "RESOLVED", { evidence: evidence([report({ description: "Seems okay." })], { severity: "HIGH" }) }),
      record("ACTIVE"),
    );
    expect(result.accepted).toBe(false);
  });

  it("reopens a resolved incident while preserving transition history", () => {
    const state = ensureIncidentLifecycle(createLifecycleState(), "incident-R-001");
    const resolved = processLifecycleTransition(
      request("CREATED", "ASSESSING"),
      state,
    );
    const reopened = processLifecycleTransition(
      request("ASSESSING", "ACTIVE", { evidence: evidence([report({ description: "Person is trapped." })], { severity: "HIGH" }) }),
      resolved.state,
    );

    expect(reopened.state.records[0]?.history).toHaveLength(2);
    expect(reopened.state.records[0]?.history[0]?.toState).toBe("ASSESSING");
    expect(reopened.state.records[0]?.currentState).toBe("ACTIVE");
  });

  it("keeps transition history append-only", () => {
    const initial = ensureIncidentLifecycle(createLifecycleState(), "incident-R-001");
    const first = processLifecycleTransition(request("CREATED", "ASSESSING"), initial);
    const second = processLifecycleTransition(request("ASSESSING", "ACTIVE"), first.state);

    expect(second.state.records[0]?.history.map((item) => item.sequence)).toEqual([1, 2]);
    expect(first.state.records[0]?.history).toHaveLength(1);
  });

  it("references the triggering report on accepted transitions", () => {
    const result = transitionIncident(
      request("CREATED", "ASSESSING", { reportId: "R-001" }),
      record("CREATED"),
    );

    expect(result.accepted).toBe(true);
    expect(result.transition?.triggeringReportId).toBe("R-001");
  });

  it("produces deterministic transition identifiers", () => {
    const first = transitionIncident(request("CREATED", "ASSESSING"), record("CREATED"));
    const second = transitionIncident(request("CREATED", "ASSESSING"), record("CREATED"));

    expect(first).toEqual(second);
    expect(first.transitionId).toBe("transition-incident-R-001-1-CREATED-ASSESSING");
  });

  it("rejects an unknown lifecycle record explicitly", () => {
    const result = processLifecycleTransition(
      request("CREATED", "ASSESSING"),
      createLifecycleState(),
    );

    expect(result.result.accepted).toBe(false);
    expect(result.result.reason).toContain("No lifecycle record");
  });

  it("does not auto-transition merely because a report was processed", () => {
    const processed = processReport(baseInput, 0);

    expect(processed.lifecycleResult).toBeNull();
    expect(processed.lifecycleState.records[0]?.currentState).toBe("CREATED");
    expect(processed.lifecycleState.records[0]?.history).toEqual([]);
  });

  it("preserves lifecycle state for malformed timestamp processing", () => {
    const processed = processReport({ ...baseInput, timestamp: "invalid" }, 0);

    expect(processed.lifecycleState.records[0]?.currentState).toBe("CREATED");
    expect(processed.normalizedReport.timestampParsed).toBeNull();
  });
});
