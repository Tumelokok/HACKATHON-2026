import { describe, expect, it } from "vitest";

import { processReport } from "../../src/domain/processing/reportProcessing";
import type { RawReportInput } from "../../src/types/report";

const firstReport: RawReportInput = {
  report_id: "R-001",
  timestamp: "2026-09-20T10:00:00Z",
  location: "Library Level 2",
  category: "Network Outage",
  reported_severity: "medium",
  description: "Network access is unavailable for students.",
  reporter_type: "student",
};

describe("report processing pipeline", () => {
  it("validates, normalizes, and correlates through processReport", () => {
    const first = processReport(firstReport, 0);
    const second = processReport(
      {
        ...firstReport,
        report_id: "R-002",
        category: "network-outage",
        location: " library - level 2 ",
        description: "Network access remains unavailable for staff.",
      },
      1,
      first.correlationState,
    );

    expect(first.passed).toBe(true);
    expect(first.normalizedReport.categoryNormalized).toBe("NETWORK_OUTAGE");
    expect(first.correlationResult.decision).toBe("NEW_INCIDENT");
    expect(second.normalizedReport.locationNormalized).toBe("library level 2");
    expect(second.correlationResult.decision).toBe("EXISTING_INCIDENT");
    expect(second.correlationState.incidents[0]?.reportIds).toEqual([
      "R-001",
      "R-002",
    ]);
  });
});