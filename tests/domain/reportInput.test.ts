import { describe, expect, it } from "vitest";

import { normalizeReport } from "../../src/domain/normalization/reportNormalization";
import { processReport } from "../../src/domain/processing/reportProcessing";
import { validateReport } from "../../src/domain/validation/reportValidation";
import type { RawReportInput } from "../../src/types/report";

const validInput: RawReportInput = {
  report_id: " R-001 ",
  timestamp: "2026-09-20T10:30:00Z",
  location: " Library - Level 2 ",
  category: " Network Outage ",
  reported_severity: " high ",
  description: "  Wi-Fi is unavailable on the second floor.  ",
  reporter_type: " student ",
};

describe("report input validation and normalization", () => {
  it("accepts a valid report and produces normalized values", () => {
    const result = processReport(validInput, 0);

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.validatedReport?.processingOrder).toBe(0);
    expect(result.normalizedReport.report_id).toBe(" R-001 ");
    expect(result.normalizedReport.categoryNormalized).toBe("NETWORK_OUTAGE");
    expect(result.normalizedReport.locationNormalized).toBe("library level 2");
    expect(result.normalizedReport.reportedSeverityNormalized).toBe("HIGH");
    expect(result.normalizedReport.reporterTypeNormalized).toBe("STUDENT");
    expect(result.normalizedReport.timestampParsed).toBeInstanceOf(Date);
  });

  it("reports a missing report ID without throwing", () => {
    const result = validateReport({ ...validInput, report_id: "  ", processingOrder: 1 });

    expect(result.passed).toBe(false);
    expect(result.validatedReport).toBeNull();
    expect(result.issues[0]?.code).toBe("REQUIRED_FIELD_BLANK");
    expect(result.issues[0]?.field).toBe("report_id");
  });

  it("detects blank required fields", () => {
    const result = validateReport({
      ...validInput,
      location: "\t",
      description: " ",
      processingOrder: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.field)).toEqual(["location", "description"]);
  });

  it("reports malformed timestamps while retaining them as evidence", () => {
    const result = processReport(
      { ...validInput, timestamp: "not-a-timestamp" },
      3,
    );

    expect(result.passed).toBe(false);
    expect(result.issues[0]?.code).toBe("INVALID_TIMESTAMP");
    expect(result.normalizedReport.timestampRaw).toBe("not-a-timestamp");
    expect(result.normalizedReport.timestampParsed).toBeNull();
    expect(result.normalizedReport).toBeDefined();
  });

  it("parses a valid timestamp deterministically", () => {
    const result = processReport(validInput, 4);

    expect(result.normalizedReport.timestampParsed?.toISOString()).toBe(
      "2026-09-20T10:30:00.000Z",
    );
  });

  it("normalizes casing and whitespace without changing raw evidence", () => {
    const result = processReport(validInput, 5);

    expect(result.normalizedReport.locationRaw).toBe(validInput.location);
    expect(result.normalizedReport.descriptionRaw).toBe(validInput.description);
    expect(result.normalizedReport.reporterTypeNormalized).toBe("STUDENT");
    expect(result.normalizedReport.reportedSeverityNormalized).toBe("HIGH");
  });

  it("normalizes common category variants to the same key", () => {
    const variants = ["network outage", "Network Outage", "NETWORK_OUTAGE", "network-outage"];
    const normalized = variants.map((category, index) =>
      normalizeReport({ ...validInput, category, processingOrder: index }).categoryNormalized,
    );

    expect(normalized).toEqual([
      "NETWORK_OUTAGE",
      "NETWORK_OUTAGE",
      "NETWORK_OUTAGE",
      "NETWORK_OUTAGE",
    ]);
  });

  it("normalizes severity and reporter type aliases", () => {
    const result = normalizeReport({
      ...validInput,
      reported_severity: " emergency ",
      reporter_type: " facilities ",
      processingOrder: 6,
    });

    expect(result.reportedSeverityNormalized).toBe("CRITICAL");
    expect(result.reporterTypeNormalized).toBe("MAINTENANCE");
  });

  it("preserves caller-supplied processing order independent of timestamps", () => {
    const first = processReport(
      { ...validInput, report_id: "R-FIRST", timestamp: "2030-01-01T00:00:00Z" },
      10,
    );
    const second = processReport(
      { ...validInput, report_id: "R-SECOND", timestamp: "2020-01-01T00:00:00Z" },
      11,
    );

    expect(first.normalizedReport.processingOrder).toBe(10);
    expect(second.normalizedReport.processingOrder).toBe(11);
  });

  it("returns multiple validation issues for one report", () => {
    const result = validateReport({
      ...validInput,
      report_id: "",
      location: " ",
      timestamp: "invalid",
      processingOrder: -1,
    });

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "REQUIRED_FIELD_BLANK",
      "REQUIRED_FIELD_BLANK",
      "INVALID_TIMESTAMP",
      "INVALID_PROCESSING_ORDER",
    ]);
    expect(result.rawReport.timestamp).toBe("invalid");
  });
});
