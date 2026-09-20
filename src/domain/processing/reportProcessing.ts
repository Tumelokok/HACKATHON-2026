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
import {
  createLifecycleState,
  ensureIncidentLifecycle,
  processLifecycleTransition,
} from "@/domain/lifecycle";
import type {
  LifecycleState,
  LifecycleTransitionIntent,
  LifecycleTransitionResult,
} from "@/domain/lifecycle";
import {
  createActionState,
} from "@/domain/actions";
import type { ActionState } from "@/domain/actions";
import { createAgentContext } from "@/domain/agent";
import type { AgentContext } from "@/domain/agent";

export interface ReportProcessingResult extends ReportValidationResult {
  validatedReport: ValidatedReport | null;
  normalizedReport: NormalizedReport;
  correlationResult: CorrelationResult;
  correlationState: CorrelationState;
  severityAssessment: SeverityAssessment | null;
  severityState: SeverityState;
  conflictResult: ConflictResult;
  conflictState: ConflictState;
  lifecycleResult: LifecycleTransitionResult | null;
  lifecycleState: LifecycleState;
  actionState: ActionState;
  agentContext: AgentContext;
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
  lifecycleState: LifecycleState = createLifecycleState(),
  lifecycleIntent?: LifecycleTransitionIntent,
  actionState: ActionState = createActionState(),
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
  const shouldEnsureLifecycle =
    correlation.result.decision !== "DUPLICATE_REPORT" &&
    correlation.result.matchStatus !== "AMBIGUOUS" &&
    confirmedIncident !== undefined &&
    processedCorrelationReport?.incidentId !== null;
  const confirmedIncidentId = processedCorrelationReport?.incidentId ?? null;
  const lifecycleStateWithIncident =
    shouldEnsureLifecycle && confirmedIncidentId
      ? ensureIncidentLifecycle(lifecycleState, confirmedIncidentId)
      : lifecycleState;
  const lifecycle =
    shouldEnsureLifecycle && confirmedIncidentId && lifecycleIntent
      ? processLifecycleTransition(
          {
            ...lifecycleIntent,
            incidentId: confirmedIncidentId,
            evidence: {
              reports: confirmedIncident?.reports ?? [normalizedReport],
              correlationResult: correlation.result,
              severityAssessment: severity?.assessment ?? null,
              conflictResult: conflict.result,
            },
          },
          lifecycleStateWithIncident,
        )
      : null;
  const lifecycleRecord = confirmedIncidentId
    ? lifecycleStateWithIncident.records.find((record) => record.incidentId === confirmedIncidentId)
    : undefined;
  const agentContext = createAgentContext({
    incidentId: confirmedIncidentId,
    incidentExists: confirmedIncident !== undefined,
    lifecycleState: lifecycleRecord?.currentState ?? null,
    lifecycleHistory: lifecycleRecord?.history ?? [],
    correlationResult: correlation.result,
    severityAssessment: severity?.assessment ?? null,
    reports: confirmedIncident?.reports ?? [normalizedReport],
    conflictRecords: conflict.state.records,
    conflictResult: conflict.result,
    actionState,
    credibleResolutionEvidence: false,
    processingOrder,
  });

  return {
    ...validation,
    normalizedReport,
    correlationResult: correlation.result,
    correlationState: correlation.state,
    severityAssessment: severity?.assessment ?? null,
    severityState: severity?.state ?? severityState,
    conflictResult: conflict.result,
    conflictState: conflict.state,
    lifecycleResult: lifecycle?.result ?? null,
    lifecycleState: lifecycle?.state ?? lifecycleStateWithIncident,
    actionState,
    agentContext,
  };
}