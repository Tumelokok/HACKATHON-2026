import { runAgent } from "@/domain/agent";
import { executeApprovedAction, submitActionProposal } from "@/domain/actions";
import { processReport } from "@/domain/processing/reportProcessing";
import type { ActionState } from "@/domain/actions";
import type { CorrelationState } from "@/domain/correlation";
import type { ConflictState } from "@/domain/conflicts";
import type { LifecycleState } from "@/domain/lifecycle";
import type { SeverityState } from "@/domain/severity";
import type { ReplayEvaluation, ReplayReportResult, ReplayScenario, ReplaySummary } from "./types";

function emptySummary(): ReplaySummary {
  return {
    reportsProcessed: 0,
    incidentsCreated: 0,
    duplicatesDetected: 0,
    conflictsDetected: 0,
    humanReviewsRequested: 0,
    actionsProposed: 0,
    actionsExecuted: 0,
    actionsSuppressed: 0,
    resolvedIncidents: 0,
    reopenedIncidents: 0,
  };
}

export function replayScenario(scenario: ReplayScenario): ReplayEvaluation {
  let correlationState: CorrelationState | undefined;
  let severityState: SeverityState | undefined;
  let conflictState: ConflictState | undefined;
  let lifecycleState: LifecycleState | undefined;
  let actionState: ActionState | undefined;
  const trace: ReplayReportResult[] = [];
  const errors: string[] = [];
  const summary = emptySummary();

  scenario.inputs.forEach((input, processingOrder) => {
    const processed = processReport(
      input.report,
      processingOrder,
      correlationState,
      severityState,
      conflictState,
      lifecycleState,
      input.lifecycleIntent,
      actionState,
    );
    correlationState = processed.correlationState;
    severityState = processed.severityState;
    conflictState = processed.conflictState;
    lifecycleState = processed.lifecycleState;
    actionState = processed.actionState;

    const agent = runAgent(processed.agentContext, input.report.timestamp);
    let currentActionState = actionState;
    const actionSnapshots: ReplayReportResult["actions"] extends readonly (infer ActionSnapshot)[]
      ? ActionSnapshot[]
      : never = [];
    if (agent.decision.actionProposal) {
      summary.actionsProposed += 1;
      const proposalResult = submitActionProposal(
        agent.decision.actionProposal,
        {
          incidentExists: processed.agentContext.incidentExists,
          incidentId: processed.agentContext.incidentId ?? "",
          incidentState: processed.agentContext.incidentState ?? "CREATED",
          severity: processed.agentContext.severity,
          conflictResult: processed.agentContext.currentConflict,
          reports: processed.agentContext.reports,
          correlationDecision: processed.agentContext.correlationDecision,
          correlationMatchStatus: processed.agentContext.correlationMatchStatus,
          credibleResolutionEvidence: processed.agentContext.credibleResolutionEvidence,
        },
        currentActionState,
      );
      currentActionState = proposalResult.state;
      let execution = null;
      if (proposalResult.policy.decision === "APPROVED") {
        const executed = executeApprovedAction(proposalResult.proposal.actionId, currentActionState);
        currentActionState = executed.state;
        execution = executed.result;
      }
      if (proposalResult.policy.decision === "SUPPRESSED") summary.actionsSuppressed += 1;
      if (execution?.status === "EXECUTED") summary.actionsExecuted += 1;
      actionSnapshots.push({
        actionId: proposalResult.proposal.actionId,
        actionType: proposalResult.proposal.actionType,
        status: execution?.status ?? proposalResult.policy.status,
        policy: proposalResult.policy,
        execution,
      });
    }
    actionState = currentActionState;

    if (processed.correlationResult.decision === "NEW_INCIDENT") summary.incidentsCreated += 1;
    if (processed.correlationResult.decision === "DUPLICATE_REPORT") summary.duplicatesDetected += 1;
    if (processed.conflictResult.conflictExists) summary.conflictsDetected += 1;
    if (agent.decision.decisionType === "REQUEST_HUMAN_REVIEW") summary.humanReviewsRequested += 1;
    if (processed.lifecycleResult?.accepted && processed.lifecycleResult.resultingState === "RESOLVED") summary.resolvedIncidents += 1;
    if (processed.lifecycleResult?.accepted && processed.lifecycleResult.fromState === "RESOLVED") summary.reopenedIncidents += 1;

    trace.push({
      processingOrder,
      reportId: input.report.report_id,
      rawReport: input.report,
      normalizedReport: processed.normalizedReport,
      validationPassed: processed.passed,
      validationIssues: processed.issues,
      correlation: processed.correlationResult,
      incidentId: processed.correlationResult.incidentId,
      duplicate: processed.correlationResult.decision === "DUPLICATE_REPORT",
      severity: processed.severityAssessment,
      conflicts: processed.conflictResult,
      lifecycle: processed.lifecycleResult,
      lifecycleState: processed.lifecycleState,
      actions: actionSnapshots,
      agent,
      auditEvents: [
        ...agent.auditEvents.map((event) => event.eventType),
        ...currentActionState.auditEvents.map((event) => event.eventType),
      ],
      errors: processed.issues.map((issue) => issue.message),
    });
  });

  const assertions = scenario.assertions.flatMap((assertion) => assertion(trace));
  return {
    scenario: scenario.name,
    passed: assertions.every((assertion) => assertion.passed) && errors.length === 0,
    summary: { ...summary, reportsProcessed: trace.length },
    assertions,
    trace,
    errors,
  };
}

export function normalizeReplayEvaluation(evaluation: ReplayEvaluation): unknown {
  return {
    scenario: evaluation.scenario,
    passed: evaluation.passed,
    summary: evaluation.summary,
    assertions: evaluation.assertions,
    trace: evaluation.trace.map((item) => ({
      processingOrder: item.processingOrder,
      reportId: item.reportId,
      validationPassed: item.validationPassed,
      validationIssues: item.validationIssues.map((issue) => ({ code: issue.code, field: issue.field })),
      normalizedReport: {
        report_id: item.normalizedReport.report_id,
        processingOrder: item.normalizedReport.processingOrder,
        timestampRaw: item.normalizedReport.timestampRaw,
        timestampParsed: item.normalizedReport.timestampParsed ? "PARSED" : null,
        locationNormalized: item.normalizedReport.locationNormalized,
        categoryNormalized: item.normalizedReport.categoryNormalized,
        reportedSeverityNormalized: item.normalizedReport.reportedSeverityNormalized,
        reporterTypeNormalized: item.normalizedReport.reporterTypeNormalized,
      },
      correlation: {
        decision: item.correlation.decision,
        matchStatus: item.correlation.matchStatus,
        incidentId: item.correlation.incidentId,
        confidence: item.correlation.confidence,
        duplicate: item.duplicate,
      },
      severity: item.severity ? { level: item.severity.level, confidence: item.severity.confidence, evidenceReportIds: item.severity.evidenceReportIds } : null,
      conflicts: { conflictExists: item.conflicts.conflictExists, conflictType: item.conflicts.conflictType, involvedReportIds: item.conflicts.involvedReportIds, requiresHumanReview: item.conflicts.requiresHumanReview },
      lifecycle: item.lifecycle ? { accepted: item.lifecycle.accepted, fromState: item.lifecycle.fromState, resultingState: item.lifecycle.resultingState, transitionId: item.lifecycle.transitionId } : null,
      actions: item.actions.map((action) => ({ actionId: action.actionId, actionType: action.actionType, status: action.status, policyDecision: action.policy?.decision, executionStatus: action.execution?.status })),
      agent: { decisionType: item.agent.decision.decisionType, confidence: item.agent.decision.confidence, actionType: item.agent.decision.actionProposal?.actionType ?? null, fallbackUsed: item.agent.decision.fallbackUsed },
      auditEvents: item.auditEvents,
      errors: item.errors,
    })),
  };
}