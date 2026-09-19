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
import {
  createSeverityState,
  reassessIncident,
} from "@/domain/severity";
import type {
  SeverityAssessment,
  SeverityState,
} from "@/domain/severity";
import {
  createConflictState,
  processConflict,
} from "@/domain/conflicts";
import type {
  ConflictResult,
  ConflictState,
} from "@/domain/conflicts";

export interface ReportProcessingResult extends ReportValidationResult {
  validatedReport: ValidatedReport | null;
  normalizedReport: NormalizedReport;
  correlationResult: CorrelationResult;
  correlationState: CorrelationState;
  severityAssessment: SeverityAssessment | null;
  severityState: SeverityState;
  conflictResult: ConflictResult;
  conflictState: ConflictState;
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
  severityState: SeverityState = createSeverityState(),
  conflictState: ConflictState = createConflictState(),
): ReportProcessingResult {
  const rawReport = { ...input, processingOrder };
  const validation = validateReport(rawReport);
  const normalizedReport = normalizeReport(rawReport);
  const correlation = processCorrelatedReport(normalizedReport, correlationState);
  const processedCorrelationReport = correlation.state.processedReports.at(-1);
  const confirmedIncident = processedCorrelationReport?.incidentId
    ? correlation.state.incidents.find(
        (incident) => incident.incidentId === processedCorrelationReport.incidentId,
      )
    : undefined;
  const shouldAssessSeverity =
    correlation.result.decision !== "DUPLICATE_REPORT" &&
    correlation.result.matchStatus !== "AMBIGUOUS" &&
    confirmedIncident !== undefined &&
    processedCorrelationReport?.incidentId !== null;
  const severity = shouldAssessSeverity && confirmedIncident && processedCorrelationReport
    ? reassessIncident(
        {
          incidentId: confirmedIncident.incidentId,
          reports: confirmedIncident.reports,
          context: { conflictEvidence: correlation.result.conflict !== null },
          assessedAt: normalizedReport.timestampParsed?.toISOString() ?? normalizedReport.timestampRaw,
        },
        severityState,
      )
    : null;
  const conflict = processConflict(
    {
      incidentId: processedCorrelationReport?.incidentId ?? null,
      reports: confirmedIncident?.reports ?? [normalizedReport],
      correlationResult: correlation.result,
      severityAssessment: severity?.assessment ?? null,
      assessedAt: normalizedReport.timestampParsed?.toISOString() ?? normalizedReport.timestampRaw,
    },
    conflictState,
  );

  return {
    ...validation,
    normalizedReport,
    correlationResult: correlation.result,
    correlationState: correlation.state,
    severityAssessment: severity?.assessment ?? null,
    severityState: severity?.state ?? severityState,
    conflictResult: conflict.result,
    conflictState: conflict.state,
  };
}