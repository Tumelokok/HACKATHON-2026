import type {
  NormalizedReport,
  RawReport,
  RawReportInput,
  ValidatedReport,
} from "@/types/report";
import {
  type ReportValidationResult,
  validateReport,
} from "@/domain/validation/reportValidation";
import { normalizeReport } from "@/domain/normalization/reportNormalization";

export interface ReportProcessingResult extends ReportValidationResult {
  validatedReport: ValidatedReport | null;
  normalizedReport: NormalizedReport;
}

export function createRawReport(
  input: RawReportInput,
  processingOrder: number,
): RawReport {
  return { ...input, processingOrder };
}

export function processReport(
  input: RawReportInput,
  processingOrder: number,
): ReportProcessingResult {
  const rawReport = { ...input, processingOrder };
  const validation = validateReport(rawReport);

  return {
    ...validation,
    normalizedReport: normalizeReport(rawReport),
  };
}