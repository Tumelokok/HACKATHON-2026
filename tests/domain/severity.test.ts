import { describe, expect, it } from "vitest";

import {
  assessSeverity,
  createSeverityState,
  reassessIncident,
} from "../../src/domain/severity";
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

function input(
  reports: ReturnType<typeof report>[],
  assessedAt = "2026-09-20T10:00:00Z",
) {
  return {
    incidentId: "incident-R-001",
    reports,
    assessedAt,
  };
}

describe("deterministic severity engine", () => {
  it("assesses a low-risk incident as LOW", () => {
    const result = assessSeverity(input([report()]));

    expect(result.assessment.level).toBe("LOW");
    expect(result.assessment.confidence).toBe(0.75);
  });

  it("assesses a moderate operational incident as MEDIUM", () => {
    const result = assessSeverity(
      input([
        report({
          reported_severity: "low",
          category: "Network Outage",
          description: "A campus-wide network outage is affecting multiple classrooms.",
        }),
      ]),
    );

    expect(result.assessment.level).toBe("MEDIUM");
  });

  it("assesses serious immediate danger as HIGH", () => {
    const result = assessSeverity(
      input([
        report({
          category: "Lift",
          description: "A person is trapped in the lift.",
          reported_severity: "low",
        }),
      ]),
    );

    expect(result.assessment.level).toBe("HIGH");
  });

  it("assesses extreme immediate danger as CRITICAL", () => {
    const result = assessSeverity(
      input([
        report({
          category: "Fire",
          description: "Fire is spreading rapidly through the building.",
          reported_severity: "low",
        }),
      ]),
    );

    expect(result.assessment.level).toBe("CRITICAL");
  });

  it("uses reported severity as evidence without allowing it to override danger", () => {
    const result = assessSeverity(
      input([
        report({
          reported_severity: "low",
          category: "Smoke",
          description: "Smoke is visible in an occupied building.",
        }),
      ]),
    );

    expect(result.assessment.level).toBe("HIGH");
    expect(result.assessment.reason).toContain("R-001");
  });

  it("preserves the safety ceiling against weak contradictory evidence", () => {
    const result = assessSeverity(
      input([
        report({
          category: "Fire",
          description: "Fire is spreading rapidly.",
          reported_severity: "critical",
        }),
        report({
          report_id: "R-002",
          category: "Other",
          description: "A minor issue is reported.",
          reported_severity: "low",
        }, 1),
      ]),
    );

    expect(result.assessment.level).toBe("CRITICAL");
    expect(result.assessment.evidenceReportIds).toEqual(["R-001", "R-002"]);
  });

  it("increases severity when multiple reports add danger evidence", () => {
    const result = assessSeverity(
      input([
        report(),
        report({
          report_id: "R-002",
          category: "Electrical",
          description: "Electrical danger and smoke are reported.",
          reported_severity: "high",
        }, 1),
      ]),
    );

    expect(result.assessment.level).toBe("HIGH");
    expect(result.assessment.confidence).toBe(0.9);
  });

  it("reassesses escalating evidence and preserves previous assessments", () => {
    const first = reassessIncident(
      input([report()], "2026-09-20T10:00:00Z"),
      createSeverityState(),
    );
    const second = reassessIncident(
      input([
        report(),
        report({
          report_id: "R-002",
          category: "Fire",
          description: "Smoke and fire are visible.",
          reported_severity: "high",
        }, 1),
      ], "2026-09-20T10:01:00Z"),
      first.state,
    );

    expect(first.assessment.level).toBe("LOW");
    expect(second.assessment.level).toBe("HIGH");
    expect(second.state.assessments.map((assessment) => assessment.level)).toEqual([
      "LOW",
      "HIGH",
    ]);
  });

    it("keeps the safety floor when control evidence arrives after a serious report", () => {
    const result = assessSeverity(
      input([
        report({
          category: "Lift",
          description: "A person is trapped in the lift.",
          reported_severity: "high",
        }),
        report({
          report_id: "R-002",
          category: "Lift",
          description: "The person is released and the lift is controlled.",
          reported_severity: "low",
        }, 1),
      ]),
    );

    // The trapped-passenger report established a HIGH safety floor.
    // A later control report may reduce the live level, but the historical
    // safety floor is monotonic and must not be erased.
    expect(result.assessment.level).toBe("HIGH");
    expect(result.assessment.evidenceReportIds).toEqual(["R-001", "R-002"]);
  });

  it("allows control evidence to lower severity when no safety floor was established", () => {
    const result = assessSeverity(
      input([
        report({
          category: "Network Outage",
          description: "A campus-wide network outage is affecting multiple classrooms.",
          reported_severity: "medium",
        }),
        report({
          report_id: "R-002",
          category: "Network Outage",
          description: "Network restored and tested successfully.",
          reported_severity: "low",
        }, 1),
      ]),
    );

    // No report in this sequence established a HIGH or CRITICAL safety floor,
    // so the control report can reduce the live level to LOW.
    expect(result.assessment.level).toBe("LOW");
    expect(result.assessment.evidenceReportIds).toEqual(["R-001", "R-002"]);
  });

  it("flags contradictory severity evidence and reduces confidence", () => {
    const result = assessSeverity(
      input([
        report({ reported_severity: "high", description: "A serious threat is reported." }),
        report({
          report_id: "R-002",
          reported_severity: "low",
          description: "The issue remains present but is described as minor.",
        }, 1),
      ]),
    );

    expect(result.assessment.conflict?.type).toBe("CONTRADICTORY_SEVERITY_EVIDENCE");
    expect(result.assessment.requiresHumanReview).toBe(true);
    expect(result.assessment.confidence).toBe(0.55);
  });

  it("includes evidence report IDs and preserves raw evidence", () => {
    const rawLocation = " Library - Level 2 ";
    const rawDescription = "  Smoke reported near the entrance.  ";
    const normalized = report({ location: rawLocation, description: rawDescription });
    const result = assessSeverity(input([normalized]));

    expect(result.assessment.evidenceReportIds).toEqual(["R-001"]);
    expect(result.evidenceReports[0]?.locationRaw).toBe(rawLocation);
    expect(result.evidenceReports[0]?.descriptionRaw).toBe(rawDescription);
    expect(result.evidenceReports[0]?.locationNormalized).toBe("library level 2");
  });

  it("retains malformed timestamps as evidence without breaking assessment", () => {
    const malformed = report({ timestamp: "not-a-timestamp" });
    const result = assessSeverity(input([malformed]));

    expect(malformed.timestampParsed).toBeNull();
    expect(malformed.timestampRaw).toBe("not-a-timestamp");
    expect(result.assessment.level).toBe("LOW");
  });

  it("uses RULE_ENGINE as the assessment source", () => {
    const result = assessSeverity(input([report()]));

    expect(result.assessment.source).toBe("RULE_ENGINE");
  });

  it("supports structured operational evidence", () => {
    const result = assessSeverity({
      ...input([report()]),
      context: {
        affectedPeople: "MANY",
        immediateDanger: true,
        operationalImpact: "WIDESPREAD",
        escalationEvidence: true,
      },
    });

    expect(result.assessment.level).toBe("HIGH");
  });

  it("preserves a previous CRITICAL assessment after later LOW evidence", () => {
    const first = reassessIncident(
      input([
        report({
          category: "Fire",
          description: "Fire is spreading rapidly.",
          reported_severity: "critical",
        }),
      ]),
      createSeverityState(),
    );
    const second = reassessIncident(
      input([
        report({
          category: "Fire",
          description: "Fire is spreading rapidly.",
          reported_severity: "critical",
        }),
        report({
          report_id: "R-002",
          category: "Other",
          description: "A minor issue is reported.",
          reported_severity: "low",
        }, 1),
      ], "2026-09-20T10:01:00Z"),
      first.state,
    );

    expect(first.state.assessments[0]?.level).toBe("CRITICAL");
    expect(second.state.assessments[0]?.level).toBe("CRITICAL");
    expect(second.state.assessments).toHaveLength(2);
  });
});
