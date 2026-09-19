import { describe, expect, it } from "vitest";

import {
  createConflictState,
  detectConflicts,
  processConflict,
} from "../../src/domain/conflicts";
import type { CorrelationResult } from "../../src/domain/correlation";
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

function confirmedCorrelation(reportId: string, incidentId = "incident-R-001"): CorrelationResult {
  return {
    reportId,
    decision: "EXISTING_INCIDENT",
    matchStatus: "MATCHED",
    incidentId,
    confidence: 1,
    evidence: { components: [], totalScore: 1, reasons: [] },
    candidateScores: [],
    duplicate: null,
    humanReview: { required: false, reason: null, candidateIncidentIds: [] },
    conflict: null,
  };
}

function directConflict(
  reports: ReturnType<typeof report>[],
  correlationResult = confirmedCorrelation(reports.at(-1)?.report_id ?? "R-002"),
) {
  return detectConflicts({
    incidentId: correlationResult.incidentId,
    reports,
    correlationResult,
    severityAssessment: null,
    assessedAt: "2026-09-20T10:02:00Z",
  });
}

function processReports(inputs: RawReportInput[]) {
  let processed = processReport(inputs[0], 0);
  for (const [index, input] of inputs.slice(1).entries()) {
    processed = processReport(
      input,
      index + 1,
      processed.correlationState,
      processed.severityState,
      processed.conflictState,
    );
  }
  return processed;
}

describe("deterministic conflict engine", () => {
  it("returns no conflict for a normal single report", () => {
    const result = directConflict([report()], {
      ...confirmedCorrelation("R-001"),
      decision: "NEW_INCIDENT",
      matchStatus: "NO_MATCH",
      incidentId: null,
    });

    expect(result.conflictExists).toBe(false);
    expect(result.status).toBeNull();
  });

  it("does not flag an ordinary operational follow-up", () => {
    const result = directConflict([
      report({ category: "Lift", description: "Lift is stuck." }),
      report({
        report_id: "R-002",
        category: "Lift",
        description: "Technician has arrived and is working on the lift.",
      }, 1),
    ]);

    expect(result.conflictExists).toBe(false);
  });

  it("does not create a conflict for an exact duplicate report", () => {
    const processed = processReports([
      reportInput(),
      reportInput({ description: "Different text with the same report ID." }),
    ]);

    expect(processed.correlationResult.decision).toBe("DUPLICATE_REPORT");
    expect(processed.conflictResult.conflictExists).toBe(false);
    expect(processed.conflictState.records).toHaveLength(0);
  });

  it("detects a severity contradiction", () => {
    const processed = processReports([
      reportInput({
        category: "Fire",
        reported_severity: "critical",
        description: "Fire spreading rapidly.",
      }),
      reportInput({
        report_id: "R-002",
        category: "Fire",
        reported_severity: "low",
        description: "Fire spreading is a minor issue.",
      }),
    ]);

    expect(processed.conflictResult.conflictType).toBe("SEVERITY_CONTRADICTION");
    expect(processed.conflictResult.requiresHumanReview).toBe(true);
  });

  it("detects a factual contradiction and preserves both reports", () => {
    const reports = [
      report({ category: "Lift", description: "Person is trapped inside lift." }),
      report({
        report_id: "R-002",
        category: "Lift",
        description: "No person is trapped inside lift.",
      }, 1),
    ];
    const result = directConflict(reports);

    expect(result.conflictType).toBe("FACTUAL_CONTRADICTION");
    expect(result.involvedReportIds).toEqual(["R-001", "R-002"]);
    expect(result.evidenceReports.map((item) => item.report_id)).toEqual(["R-001", "R-002"]);
    expect(result.evidenceReports[0]?.descriptionRaw).toBe("Person is trapped inside lift.");
  });

  it("detects a state contradiction when active danger conflicts with normal operation", () => {
    const result = directConflict([
      report({ category: "Lift", description: "Person is still trapped in lift." }),
      report({
        report_id: "R-002",
        category: "Lift",
        description: "Lift is fully repaired and operating normally.",
      }, 1),
    ]);

    expect(result.conflictType).toBe("STATE_CONTRADICTION");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("detects materially incompatible location evidence", () => {
    const result = directConflict([
      report({ location: "Library Level 2" }),
      report({ report_id: "R-002", location: "North Gate" }, 1),
    ]);

    expect(result.conflictType).toBe("LOCATION_CONTRADICTION");
    expect(result.confidence).toBeLessThan(0.8);
  });

  it("detects a configured materially incompatible category pair", () => {
    const result = directConflict([
      report({ category: "Fire" }),
      report({ report_id: "R-002", category: "Network Outage" }, 1),
    ]);

    expect(result.conflictType).toBe("CATEGORY_CONTRADICTION");
  });

  it("requires review for strong conflicts and references report IDs in the explanation", () => {
    const result = directConflict([
      report({ category: "Lift", description: "Person is trapped inside lift." }),
      report({
        report_id: "R-002",
        category: "Lift",
        description: "No person is trapped inside lift.",
      }, 1),
    ]);

    expect(result.status).toBe("UNDER_REVIEW");
    expect(result.explanation).toContain("R-001");
    expect(result.explanation).toContain("R-002");
  });

  it("keeps weak location contradiction confidence below strong factual evidence", () => {
    const result = directConflict([
      report({ location: "Library" }),
      report({ report_id: "R-002", location: "North Gate" }, 1),
    ]);

    expect(result.confidence).toBe(0.7);
    expect(result.requiresHumanReview).toBe(true);
  });

  it("does not flag credible release or power-isolation control as conflict", () => {
    const released = directConflict([
      report({ category: "Lift", description: "Person is trapped inside lift." }),
      report({
        report_id: "R-002",
        category: "Lift",
        description: "Person is released from the lift.",
      }, 1),
    ]);
    const isolated = directConflict([
      report({ category: "Electrical", description: "Electrical sparks continuing." }),
      report({
        report_id: "R-002",
        category: "Electrical",
        description: "Power isolated and no sparks.",
      }, 1),
    ]);

    expect(released.conflictExists).toBe(false);
    expect(isolated.conflictExists).toBe(false);
  });

  it("does not allow ambiguous correlation to create a conflict", () => {
    const result = directConflict(
      [
        report({ category: "Lift", description: "Person is trapped inside lift." }),
        report({ report_id: "R-002", category: "Lift", description: "No person is trapped." }, 1),
      ],
      {
        ...confirmedCorrelation("R-002"),
        matchStatus: "AMBIGUOUS",
      },
    );

    expect(result.conflictExists).toBe(false);
  });

  it("does not allow duplicate correlation to create a conflict", () => {
    const result = directConflict(
      [
        report({ category: "Lift", description: "Person is trapped inside lift." }),
        report({ report_id: "R-002", category: "Lift", description: "No person is trapped." }, 1),
      ],
      {
        ...confirmedCorrelation("R-002"),
        decision: "DUPLICATE_REPORT",
      },
    );

    expect(result.conflictExists).toBe(false);
  });

  it("handles malformed timestamps without breaking detection", () => {
    const result = directConflict([
      report({ category: "Lift", description: "Person is trapped inside lift.", timestamp: "invalid" }),
      report({
        report_id: "R-002",
        category: "Lift",
        description: "No person is trapped inside lift.",
        timestamp: "also-invalid",
      }, 1),
    ]);

    expect(result.conflictType).toBe("FACTUAL_CONTRADICTION");
  });

  it("includes all relevant reports when multiple contradictions contribute", () => {
    const result = directConflict([
      report({ category: "Fire", description: "Fire and smoke are present." }),
      report({
        report_id: "R-002",
        category: "Fire",
        description: "No fire visible but smoke is present.",
      }, 1),
      report({
        report_id: "R-003",
        category: "Fire",
        description: "No smoke visible and fire is controlled.",
      }, 2),
    ]);

    expect(result.involvedReportIds).toEqual(["R-001", "R-002", "R-003"]);
    expect(result.signals.length).toBeGreaterThan(1);
  });

  it("deduplicates repeated identical conflict records", () => {
    const input = {
      incidentId: "incident-R-001",
      reports: [
        report({ category: "Lift", description: "Person is trapped inside lift." }),
        report({
          report_id: "R-002",
          category: "Lift",
          description: "No person is trapped inside lift.",
        }, 1),
      ],
      correlationResult: confirmedCorrelation("R-002"),
      severityAssessment: null,
      assessedAt: "2026-09-20T10:02:00Z",
    };
    const first = processConflict(input, createConflictState());
    const second = processConflict(input, first.state);

    expect(first.state.records).toHaveLength(1);
    expect(second.state.records).toHaveLength(1);
    expect(second.result.isDuplicate).toBe(true);
    expect(second.result.duplicateOfConflictId).toBe(first.result.conflictId);
  });

  it("produces the same result for the same ordered evidence", () => {
    const reports = [
      report({ category: "Lift", description: "Person is trapped inside lift." }),
      report({
        report_id: "R-002",
        category: "Lift",
        description: "No person is trapped inside lift.",
      }, 1),
    ];

    expect(directConflict(reports)).toEqual(directConflict(reports));
  });

  it("keeps the severity safety ceiling visible alongside conflict detection", () => {
    const processed = processReports([
      reportInput({
        category: "Fire",
        reported_severity: "critical",
        description: "Fire spreading rapidly.",
      }),
      reportInput({
        report_id: "R-002",
        category: "Fire",
        reported_severity: "low",
        description: "Fire spreading is a minor issue.",
      }),
    ]);

    expect(processed.severityAssessment?.level).toBe("CRITICAL");
    expect(processed.conflictResult.conflictExists).toBe(true);
  });
});

function reportInput(overrides: Partial<RawReportInput> = {}): RawReportInput {
  return { ...baseInput, ...overrides };
}
