import { orchestrateReport } from "@/domain/orchestration";
import type { OrchestrationState } from "@/domain/orchestration";
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
  let state: OrchestrationState | undefined;
  const trace: ReplayReportResult[] = [];
  const errors: string[] = [];
  const summary = emptySummary();

  scenario.inputs.forEach((input, processingOrder) => {
    const orchestration = orchestrateReport({ report: input.report, processingOrder, state });
    state = orchestration.state;
    const processed = orchestration.processing;
    const agent = orchestration.agent;
    const actionSnapshots = orchestration.actionResults.map((result) => ({
      actionId: result.proposal.actionId,
      actionType: result.proposal.actionType,
      status: result.execution?.status ?? result.decision.status,
      policy: result.decision,
      execution: result.execution,
    }));
    summary.actionsProposed += orchestration.actionProposals.length;
    summary.actionsSuppressed += orchestration.suppressedActions.length;
    summary.actionsExecuted += orchestration.executedActions.filter((execution) => execution.status === "EXECUTED").length;

    if (processed.correlationResult.decision === "NEW_INCIDENT") summary.incidentsCreated += 1;
    if (processed.correlationResult.decision === "DUPLICATE_REPORT") summary.duplicatesDetected += 1;
    if (processed.conflictResult.conflictExists) summary.conflictsDetected += 1;
    if (agent.decision.decisionType === "REQUEST_HUMAN_REVIEW") summary.humanReviewsRequested += 1;
    if (orchestration.lifecycleResults.some((result) => result.accepted && result.resultingState === "RESOLVED")) summary.resolvedIncidents += 1;
    if (orchestration.lifecycleResults.some((result) => result.accepted && result.fromState === "RESOLVED")) summary.reopenedIncidents += 1;

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
      lifecycle: orchestration.lifecycleResults,
      lifecycleState: orchestration.lifecycleState,
      actions: actionSnapshots,
      agent,
      auditEvents: [
        ...orchestration.auditEvents.map((event) => event.eventType),
        ...orchestration.state.actionState.auditEvents.map((event) => event.eventType),
      ],
      errors: orchestration.errors,
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
      lifecycle: item.lifecycle.map((result) => ({ accepted: result.accepted, fromState: result.fromState, resultingState: result.resultingState, transitionId: result.transitionId })),
      actions: item.actions.map((action) => ({ actionId: action.actionId, actionType: action.actionType, status: action.status, policyDecision: action.policy?.decision, executionStatus: action.execution?.status })),
      agent: { decisionType: item.agent.decision.decisionType, confidence: item.agent.decision.confidence, actionType: item.agent.decision.actionProposal?.actionType ?? null, fallbackUsed: item.agent.decision.fallbackUsed },
      auditEvents: item.auditEvents,
      errors: item.errors,
    })),
  };
}