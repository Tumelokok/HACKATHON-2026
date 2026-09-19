import type { AgentContext, AgentContextInput } from "./types";

export function createAgentContext(input: AgentContextInput): AgentContext {
  const rawEvidenceReportIds = input.reports.map((report) => report.report_id);
  return {
    incidentId: input.incidentId,
    incidentExists: input.incidentExists,
    incidentState: input.lifecycleState,
    severity: input.severityAssessment?.level ?? null,
    severityConfidence: input.severityAssessment?.confidence ?? null,
    correlationConfidence: input.correlationResult.confidence,
    correlationDecision: input.correlationResult.decision,
    correlationMatchStatus: input.correlationResult.matchStatus,
    reports: input.reports,
    normalizedEvidence: input.reports,
    rawEvidenceReportIds,
    conflicts: input.conflictRecords,
    currentConflict: input.conflictResult,
    lifecycleHistory: input.lifecycleHistory,
    previousActions: input.actionState.records,
    actionHistory: input.actionState.auditEvents,
    humanReviewRequired:
      input.correlationResult.humanReview.required ||
      input.severityAssessment?.requiresHumanReview === true ||
      input.conflictResult?.requiresHumanReview === true,
    credibleResolutionEvidence: input.credibleResolutionEvidence,
    processingOrder: input.processingOrder,
  };
}