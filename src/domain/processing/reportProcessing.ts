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
import {
  createCorrelationState,
  processCorrelatedReport,
} from "@/domain/correlation";
import type {
  CorrelationResult,
  CorrelationState,
} from "@/domain/correlation";

export interface ReportProcessingResult extends ReportValidationResult {
  validatedReport: ValidatedReport | null;
  normalizedReport: NormalizedReport;
  correlationResult: CorrelationResult;
  correlationState: CorrelationState;
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
  correlationState: CorrelationState = createCorrelationState(),
): ReportProcessingResult {
  const rawReport = { ...input, processingOrder };
  const validation = validateReport(rawReport);
  const normalizedReport = normalizeReport(rawReport);
  const correlation = processCorrelatedReport(normalizedReport, correlationState);

  return {
    ...validation,
    normalizedReport,
    correlationResult: correlation.result,
    correlationState: correlation.state,
  };
}