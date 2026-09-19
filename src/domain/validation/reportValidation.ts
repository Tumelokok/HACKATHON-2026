import type { RawReport, ValidatedReport } from "@/types/report";

export type ValidationIssueCode =
  | "REQUIRED_FIELD_BLANK"
  | "INVALID_TIMESTAMP"
  | "INVALID_PROCESSING_ORDER";

export interface ValidationIssue {
  code: ValidationIssueCode;
  field: keyof RawReport;
  message: string;
  value: string | number;
}

export interface ReportValidationResult {
  passed: boolean;
  issues: readonly ValidationIssue[];
  rawReport: RawReport;
  validatedReport: ValidatedReport | null;
}

const requiredFields = [
  "report_id",
  "timestamp",
  "location",
  "category",
  "reported_severity",
  "description",
  "reporter_type",
] as const satisfies readonly (keyof RawReport)[];

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function isValidTimestamp(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function isValidProcessingOrder(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function validateReport(rawReport: RawReport): ReportValidationResult {
  const issues: ValidationIssue[] = [];

  for (const field of requiredFields) {
    const value = rawReport[field];
    if (typeof value === "string" && isBlank(value)) {
      issues.push({
        code: "REQUIRED_FIELD_BLANK",
        field,
        message: `${field} must be present and not blank`,
        value,
      });
    }
  }

  if (!isBlank(rawReport.timestamp) && !isValidTimestamp(rawReport.timestamp)) {
    issues.push({
      code: "INVALID_TIMESTAMP",
      field: "timestamp",
      message: "timestamp is not a valid date-time value",
      value: rawReport.timestamp,
    });
  }

  if (!isValidProcessingOrder(rawReport.processingOrder)) {
    issues.push({
      code: "INVALID_PROCESSING_ORDER",
      field: "processingOrder",
      message: "processingOrder must be a non-negative integer supplied by the caller",
      value: rawReport.processingOrder,
    });
  }

  const hasBlankRequiredField = issues.some(
    (issue) => issue.code === "REQUIRED_FIELD_BLANK",
  );

  return {
    passed: issues.length === 0,
    issues,
    rawReport,
    validatedReport: hasBlankRequiredField ? null : rawReport,
  };
}