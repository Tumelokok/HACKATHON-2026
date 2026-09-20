import { describe, expect, it } from "vitest";

import {
  CORRELATION_CONFIG,
  createCorrelationState,
  processCorrelatedReport,
} from "../../src/domain/correlation";
import { processReport } from "../../src/domain/processing/reportProcessing";
import type { RawReportInput } from "../../src/types/report";

const baseInput: RawReportInput = {
  report_id: "R-001",
  timestamp: "2026-09-20T10:00:00Z",
  location: "Library Level 2",
  category: "Network Outage",
  reported_severity: "medium",
  description: "Network access is unavailable for students.",
  reporter_type: "student",
};

function report(
  overrides: Partial<RawReportInput> = {},
  processingOrder = 0,
) {
  return processReport({ ...baseInput, ...overrides }, processingOrder).normalizedReport;
}

describe("incident correlation", () => {
  it("classifies a report with no candidates as NEW_INCIDENT", () => {
    const processed = processCorrelatedReport(report(), createCorrelationState());

    expect(processed.result.decision).toBe("NEW_INCIDENT");
    expect(processed.result.matchStatus).toBe("NO_MATCH");
    expect(processed.result.incidentId).toBeNull();
    expect(processed.state.incidents).toHaveLength(1);
  });

  it("matches the same location and category at the existing threshold", () => {
    let state = createCorrelationState();
    const first = processCorrelatedReport(report(), state);
    state = first.state;

    const second = processCorrelatedReport(
      report({
        report_id: "R-002",
        description: "Network access remains unavailable for staff.",
      }, 1),
      state,
    );

    expect(second.result.decision).toBe("EXISTING_INCIDENT");
    expect(second.result.matchStatus).toBe("MATCHED");
    expect(second.result.confidence).toBeGreaterThanOrEqual(
      CORRELATION_CONFIG.thresholds.existingIncident,
    );
    expect(second.result.incidentId).toBe(first.state.incidents[0]?.incidentId);
  });

  it("does not automatically match a same-location unrelated category", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;

    const result = processCorrelatedReport(
      report({ report_id: "R-002", category: "Security", description: "A separate security concern." }, 1),
      state,
    ).result;

    expect(result.decision).toBe("NEW_INCIDENT");
    expect(result.confidence).toBeLessThan(CORRELATION_CONFIG.thresholds.ambiguous);
  });

  it("uses similar description context as correlation evidence", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;

    const result = processCorrelatedReport(
      report({
        report_id: "R-002",
        location: "Library Level 3",
        description: "Network access is unavailable for staff.",
      }, 1),
      state,
    ).result;
    const descriptionEvidence = result.candidateScores[0]?.evidence.components.find(
      (component) => component.name === "description",
    );

    expect(descriptionEvidence?.score).toBeGreaterThan(0);
    expect(result.candidateScores[0]?.evidence.reasons).toContain(
      "Description tokens overlap with existing incident evidence",
    );
  });

  it("classifies an exact report ID repeat as DUPLICATE_REPORT", () => {
    let state = createCorrelationState();
    const first = processCorrelatedReport(report(), state);
    state = first.state;

    const duplicate = processCorrelatedReport(
      report({ description: "Different text must not defeat exact ID detection." }, 1),
      state,
    );

    expect(duplicate.result.decision).toBe("DUPLICATE_REPORT");
    expect(duplicate.result.duplicate?.originalReportId).toBe("R-001");
    expect(duplicate.result.duplicate?.originalIncidentId).toBe(
      first.state.incidents[0]?.incidentId,
    );
    expect(duplicate.state.incidents).toHaveLength(1);
    expect(duplicate.state.incidents[0]?.reportIds).toEqual(["R-001"]);
  });

  it("classifies a report with an explicit duplicate marker as DUPLICATE_REPORT", () => {
    const first = processCorrelatedReport(
      report({
        report_id: "R-010",
        location: "Library Level 2",
        category: "facilities",
        description: "Water is pooling near the study desks.",
      }),
      createCorrelationState(),
    );

    const second = processCorrelatedReport(
      report({
        report_id: "R-011",
        location: "Library Level 2",
        category: "facilities",
        description: "Duplicate report: water beside the level two printers.",
      }, 1),
      first.state,
    );

    expect(second.result.decision).toBe("DUPLICATE_REPORT");
    expect(second.result.duplicate?.originalReportId).toBe("R-010");
    expect(second.result.duplicate?.originalIncidentId).toBe(
      first.state.incidents[0]?.incidentId,
    );
    expect(second.result.incidentId).toBe(
      first.state.incidents[0]?.incidentId,
    );
  });

  it("does not classify a report as duplicate when it lacks an explicit marker", () => {
    const first = processCorrelatedReport(
      report({
        report_id: "R-020",
        location: "Library Level 2",
        category: "facilities",
        description: "Water is pooling near the study desks.",
      }),
      createCorrelationState(),
    );

    const second = processCorrelatedReport(
      report({
        report_id: "R-021",
        location: "Library Level 2",
        category: "facilities",
        description: "Another student reports the same wet floor beside the printers.",
      }, 1),
      first.state,
    );

    expect(second.result.decision).toBe("EXISTING_INCIDENT");
  });

  it("does not classify a report as duplicate when its location or category differs", () => {
    const first = processCorrelatedReport(
      report({
        report_id: "R-030",
        location: "Library Level 2",
        category: "facilities",
        description: "Water is pooling near the study desks.",
      }),
      createCorrelationState(),
    );

    const second = processCorrelatedReport(
      report({
        report_id: "R-031",
        location: "Engineering Block E3",
        category: "fire",
        description: "Duplicate report: unrelated description.",
      }, 1),
      first.state,
    );

    expect(second.result.decision).not.toBe("DUPLICATE_REPORT");
  });

  it("keeps a meaningful follow-up associated with the existing incident", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;

    const followUp = processCorrelatedReport(
      report({
        report_id: "R-002",
        description: "ICT confirms the outage and is working on restoration.",
        reporter_type: "ICT",
      }, 1),
      state,
    );

    expect(followUp.result.decision).toBe("EXISTING_INCIDENT");
    expect(followUp.state.incidents).toHaveLength(1);
    expect(followUp.state.incidents[0]?.reportIds).toEqual(["R-001", "R-002"]);
  });

  it("preserves contradictory evidence and emits a conflict signal", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(
      report({
        category: "Lift",
        description: "Lift doors are closed.",
      }),
      state,
    ).state;

    const contradictory = processCorrelatedReport(
      report({
        report_id: "R-002",
        category: "Lift",
        description: "Lift doors are open.",
      }, 1),
      state,
    );

    expect(contradictory.result.decision).toBe("EXISTING_INCIDENT");
    expect(contradictory.result.conflict?.type).toBe("CONTRADICTORY_EVIDENCE");
    expect(contradictory.result.conflict?.reportIds).toEqual(["R-002", "R-001"]);
    expect(contradictory.state.incidents[0]?.reportIds).toEqual(["R-001", "R-002"]);
  });

  it("requires human review for an ambiguous candidate", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;

    const ambiguous = processCorrelatedReport(
      report({
        report_id: "R-002",
        category: "Network Outage",
        description: "A separate concern is reported elsewhere.",
      }, 11),
      state,
    );

    expect(ambiguous.result.matchStatus).toBe("AMBIGUOUS");
    expect(ambiguous.result.humanReview.required).toBe(true);
    expect(ambiguous.result.humanReview.candidateIncidentIds).toContain(
      state.incidents[0]?.incidentId,
    );
    expect(ambiguous.result.candidateScores).toHaveLength(1);
  });

  it("attaches an ambiguous match to the incident and flags it for human review", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;

    const ambiguous = processCorrelatedReport(
      report({
        report_id: "R-002",
        category: "Network Outage",
        description: "A separate concern is reported elsewhere.",
      }, 11),
      state,
    );

    // Ambiguous matches are still attached to the best candidate incident.
    // The humanReview flag is what signals the uncertainty; refusing to
    // attach the report would orphan evidence that clearly belongs to
    // an existing incident.
    expect(ambiguous.result.matchStatus).toBe("AMBIGUOUS");
    expect(ambiguous.result.humanReview.required).toBe(true);
    expect(ambiguous.state.incidents[0]?.reportIds).toEqual(["R-001", "R-002"]);
    expect(ambiguous.state.processedReports[1]?.incidentId).toBe(
      "incident-R-001",
    );
  });

  it("associates a category-changing resolution report", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;

    const resolution = processCorrelatedReport(
      report({
        report_id: "R-002",
        category: "Maintenance",
        description: "The network outage is resolved after restoration and control.",
      }, 1),
      state,
    );

    expect(resolution.result.decision).toBe("EXISTING_INCIDENT");
    expect(resolution.result.matchStatus).toBe("MATCHED");
    expect(resolution.state.incidents[0]?.reportIds).toEqual(["R-001", "R-002"]);
  });

  it("recognizes control and restoration as operational follow-up context", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;

    const followUp = processCorrelatedReport(
      report({
        report_id: "R-002",
        description: "Maintenance confirms restoration is complete and controlled.",
      }, 1),
      state,
    );

    const contextEvidence = followUp.result.evidence.components.find(
      (component) => component.name === "context",
    );
    expect(contextEvidence?.score).toBe(1);
    expect(followUp.result.matchStatus).toBe("MATCHED");
  });

  it("reports zero confidence when no candidate evidence exists", () => {
    const result = processCorrelatedReport(report(), createCorrelationState());

    expect(result.result.decision).toBe("NEW_INCIDENT");
    expect(result.result.confidence).toBe(0);
    expect(result.result.evidence.totalScore).toBe(0);
  });

  describe("documented score boundaries", () => {
    it("treats exactly 0.50 as ambiguous", () => {
      let state = createCorrelationState();
      state = processCorrelatedReport(
        report({ description: "alpha beta gamma delta" }),
        state,
      ).state;
      const result = processCorrelatedReport(
        report({
          report_id: "R-002",
          category: "Security",
          description: "alpha epsilon",
        }, 1),
        state,
      ).result;

      expect(result.confidence).toBe(0.5);
      expect(result.matchStatus).toBe("AMBIGUOUS");
      expect(result.humanReview.required).toBe(true);
    });

    it("treats just below 0.50 as NEW_INCIDENT", () => {
      let state = createCorrelationState();
      state = processCorrelatedReport(
        report({ description: "alpha beta" }),
        state,
      ).state;
      const result = processCorrelatedReport(
        report({
          report_id: "R-002",
          category: "Security",
          description: "gamma delta",
        }, 1),
        state,
      ).result;

      expect(result.confidence).toBe(0.45);
      expect(result.decision).toBe("NEW_INCIDENT");
    });

    it("treats exactly 0.75 as a matched existing incident", () => {
      let state = createCorrelationState();
      state = processCorrelatedReport(
        report({ description: "alpha beta gamma" }),
        state,
      ).state;
      const result = processCorrelatedReport(
        report({
          report_id: "R-002",
          description: "alpha beta delta epsilon",
        }, 1),
        state,
      ).result;

      expect(result.confidence).toBe(0.75);
      expect(result.matchStatus).toBe("MATCHED");
    });

    it("treats just below 0.75 as ambiguous", () => {
      let state = createCorrelationState();
      state = processCorrelatedReport(
        report({ description: "alpha beta gamma delta epsilon" }),
        state,
      ).state;
      const result = processCorrelatedReport(
        report({
          report_id: "R-002",
          description: "alpha beta gamma zeta eta theta",
        }, 1),
        state,
      ).result;

      expect(result.confidence).toBe(0.7438);
      expect(result.matchStatus).toBe("AMBIGUOUS");
    });

    it("treats just above 0.75 as a matched existing incident", () => {
      let state = createCorrelationState();
      state = processCorrelatedReport(
        report({ description: "alpha beta gamma" }),
        state,
      ).state;
      const result = processCorrelatedReport(
        report({
          report_id: "R-002",
          description: "alpha beta delta",
        }, 1),
        state,
      ).result;

      expect(result.confidence).toBe(0.775);
      expect(result.matchStatus).toBe("MATCHED");
    });
  });

  it("correlates a malformed timestamp without using it for ordering", () => {
    let state = createCorrelationState();
    const first = processCorrelatedReport(
      report({ timestamp: "not-a-timestamp" }),
      state,
    );
    state = first.state;
    const second = processCorrelatedReport(
      report({ report_id: "R-002", timestamp: "2020-01-01T00:00:00Z" }, 1),
      state,
    );

    expect(first.result.decision).toBe("NEW_INCIDENT");
    expect(first.state.incidents[0]?.reports[0]?.timestampRaw).toBe("not-a-timestamp");
    expect(first.state.incidents[0]?.reports[0]?.timestampParsed).toBeNull();
    expect(second.result.decision).toBe("EXISTING_INCIDENT");
  });

  it("respects processing order instead of timestamp order", () => {
    let state = createCorrelationState();
    const first = processCorrelatedReport(
      report({ timestamp: "2030-01-01T00:00:00Z" }, 0),
      state,
    );
    state = first.state;
    const second = processCorrelatedReport(
      report({ report_id: "R-002", timestamp: "2020-01-01T00:00:00Z" }, 1),
      state,
    );

    expect(second.result.decision).toBe("EXISTING_INCIDENT");
    expect(second.state.incidents[0]?.reports.map((item) => item.processingOrder)).toEqual([0, 1]);
  });

  it("allows multiple reports to belong to one incident", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;
    state = processCorrelatedReport(report({ report_id: "R-002" }, 1), state).state;
    state = processCorrelatedReport(report({ report_id: "R-003" }, 2), state).state;

    expect(state.incidents).toHaveLength(1);
    expect(state.incidents[0]?.reportIds).toEqual(["R-001", "R-002", "R-003"]);
  });

  it("creates separate incidents for distinct unrelated reports", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;
    state = processCorrelatedReport(
      report({
        report_id: "R-002",
        location: "North Gate",
        category: "Security",
        description: "A separate security concern is reported.",
      }, 1),
      state,
    ).state;

    expect(state.incidents).toHaveLength(2);
    expect(state.incidents.map((incident) => incident.reportIds)).toEqual([
      ["R-001"],
      ["R-002"],
    ]);
  });

  it("uses normalized values while preserving raw values", () => {
    const normalized = report({
      location: " Library - Level 2 ",
      category: " NETWORK_OUTAGE ",
      description: "  Original evidence stays exact.  ",
    });
    let state = processCorrelatedReport(normalized, createCorrelationState()).state;
    const result = processCorrelatedReport(
      report({
        report_id: "R-002",
        location: "library level 2",
        category: "network outage",
        description: "Original evidence stays exact.",
      }, 1),
      state,
    );
    state = result.state;

    expect(result.result.decision).toBe("EXISTING_INCIDENT");
    expect(state.incidents[0]?.reports[0]?.locationRaw).toBe(" Library - Level 2 ");
    expect(state.incidents[0]?.reports[0]?.categoryRaw).toBe(" NETWORK_OUTAGE ");
    expect(state.incidents[0]?.reports[0]?.descriptionRaw).toBe("  Original evidence stays exact.  ");
    expect(result.result.evidence.components).toHaveLength(5);
  });

  it("exposes confidence, component scores, and deterministic reasons", () => {
    let state = createCorrelationState();
    state = processCorrelatedReport(report(), state).state;
    const result = processCorrelatedReport(report({ report_id: "R-002" }, 1), state).result;

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.evidence.totalScore).toBe(result.confidence);
    expect(result.evidence.components.map((component) => component.name)).toEqual([
      "location",
      "category",
      "description",
      "context",
      "activity",
    ]);
    expect(result.evidence.reasons.length).toBeGreaterThan(0);
  });
});
