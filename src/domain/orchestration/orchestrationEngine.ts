import { createAgentContext, runAgent } from "@/domain/agent";
import { createActionProposal, executeApprovedAction, submitActionProposal } from "@/domain/actions";
import type { ActionProposal, ActionState } from "@/domain/actions";
import { processReport } from "@/domain/processing/reportProcessing";
import { processLifecycleTransition } from "@/domain/lifecycle";
import type { LifecycleTransitionIntent, LifecycleTransitionResult } from "@/domain/lifecycle";
import { hasCredibleResolutionEvidence, recommendedLifecycleIntent, isSerious } from "./orchestrationPolicy";
import type { OrchestrationActionResult, OrchestrationInput, OrchestrationResult, OrchestrationState } from "./types";

function initialState(state: OrchestrationInput["state"]): OrchestrationState {
  return {
    correlationState: state?.correlationState ?? { processedReports: [], incidents: [] },
    severityState: state?.severityState ?? { assessments: [] },
    conflictState: state?.conflictState ?? { records: [] },
    lifecycleState: state?.lifecycleState ?? { records: [] },
    actionState: state?.actionState ?? { records: [], auditEvents: [] },
  };
}

function actionSuggestions(
  reports: readonly OrchestrationResult["report"][],
  severity: OrchestrationResult["processing"]["severityAssessment"],
  conflictRequiresReview: boolean,
): readonly { actionType: ActionProposal["actionType"]; reason: string }[] {
  const categories = new Set(reports.map((report) => report.categoryNormalized));
  const descriptions = reports.map((report) => report.descriptionRaw.toLowerCase()).join(" ");
  const suggestions: { actionType: ActionProposal["actionType"]; reason: string }[] = [];
  if (categories.has("NETWORK_OUTAGE") || descriptions.includes("network") || descriptions.includes("wifi")) {
    suggestions.push({ actionType: "NOTIFY_ICT", reason: "Network evidence requires ICT coordination." });
  }
  if (categories.has("SMOKE") || categories.has("FIRE") || categories.has("ELECTRICAL") || isSerious(severity?.level ?? null)) {
    suggestions.push({ actionType: "NOTIFY_SECURITY", reason: "Safety evidence supports security coordination." });
    if (categories.has("ELECTRICAL") || descriptions.includes("panel") || descriptions.includes("sparks") || categories.has("SMOKE")) {
      suggestions.push({ actionType: "NOTIFY_MAINTENANCE", reason: "Infrastructure evidence supports maintenance coordination." });
    }
  }
  if (categories.has("LIFT") || descriptions.includes("wheelchair") || descriptions.includes("accessibility")) {
    suggestions.push({ actionType: "NOTIFY_MAINTENANCE", reason: "Lift/accessibility evidence supports maintenance coordination." });
  }
  if (categories.has("SECURITY") && (descriptions.includes("contractor") || descriptions.includes("cannot verify") || descriptions.includes("uncertain"))) {
    suggestions.push({ actionType: "REQUEST_HUMAN_REVIEW", reason: "Contractor verification remains uncertain." });
    suggestions.push({ actionType: "NOTIFY_SECURITY", reason: "Unverified contractor access requires security review." });
  }
  if (conflictRequiresReview) suggestions.push({ actionType: "REQUEST_HUMAN_REVIEW", reason: "Conflicting safety evidence requires human review." });
  return suggestions;
}

function intentRequest(
  intent: NonNullable<ReturnType<typeof recommendedLifecycleIntent>>,
  state: OrchestrationResult["lifecycleState"],
  incidentId: string,
  reportId: string,
  now: string,
): LifecycleTransitionIntent | null {
  const record = state.records.find((item) => item.incidentId === incidentId);
  if (!record) return null;
  const map = { ASSESS: "ASSESSING", ACTIVATE: "ACTIVE", RESPOND: "RESPONDING", MONITOR: "MONITORING", ESCALATE: "ESCALATED", RESOLVE: "RESOLVED", REOPEN: "ACTIVE", CANCEL: "CANCELLED" } as const;
  return { fromState: record.currentState, requestedState: map[intent], reason: `Orchestrator evidence supports ${intent.toLowerCase()} intent.`, triggeringReportId: reportId, actor: "APPLICATION", requestedAt: now };
}

export function orchestrateReport(input: OrchestrationInput): OrchestrationResult {
  const state = initialState(input.state);
  const processing = processReport(input.report, input.processingOrder, state.correlationState, state.severityState, state.conflictState, state.lifecycleState, undefined, state.actionState);
  const incidentId = processing.agentContext.incidentId;
  const lifecycleRecord = incidentId ? processing.lifecycleState.records.find((record) => record.incidentId === incidentId) : undefined;
  const lifecycleBefore = lifecycleRecord?.currentState ?? null;
  let lifecycleState = processing.lifecycleState;
  const lifecycleResults: LifecycleTransitionResult[] = [];
  let intent: OrchestrationResult["lifecycleIntent"] = null;

  for (let step = 0; step < 4 && incidentId; step += 1) {
    const currentRecord = lifecycleState.records.find((record) => record.incidentId === incidentId);
    const nextIntent = currentRecord
      ? recommendedLifecycleIntent(currentRecord.currentState, processing.severityAssessment?.level ?? null, processing.agentContext.reports, processing.conflictResult.requiresHumanReview)
      : null;
    if (!nextIntent) break;
    const request = intentRequest(nextIntent, lifecycleState, incidentId, input.report.report_id, input.report.timestamp);
    if (!request) break;
    const transition = processLifecycleTransition({ ...request, incidentId, evidence: { reports: processing.agentContext.reports, correlationResult: processing.correlationResult, severityAssessment: processing.severityAssessment, conflictResult: processing.conflictResult } }, lifecycleState);
    intent = nextIntent;
    lifecycleState = transition.state;
    lifecycleResults.push(transition.result);
    if (!transition.result.accepted) break;
    if (transition.result.resultingState === "RESOLVED") break;
    // Reopening is terminal for the current report cycle, symmetric with
    // resolution. Otherwise a later report that reopens a resolved incident
    // is immediately re-resolved in the same loop on the accumulated
    // evidence of the older resolution report, undoing the reopen.
    if (
      transition.result.accepted &&
      transition.result.fromState === "RESOLVED"
    ) {
      break;
    }
  }

  const freshRecord = incidentId ? lifecycleState.records.find((record) => record.incidentId === incidentId) : undefined;
  const context = createAgentContext({ incidentId, incidentExists: processing.agentContext.incidentExists, lifecycleState: freshRecord?.currentState ?? null, lifecycleHistory: freshRecord?.history ?? [], correlationResult: processing.correlationResult, severityAssessment: processing.severityAssessment, reports: processing.agentContext.reports, conflictRecords: processing.conflictState.records, conflictResult: processing.conflictResult, actionState: state.actionState, credibleResolutionEvidence: hasCredibleResolutionEvidence(processing.agentContext.reports), processingOrder: input.processingOrder });
  const agent = runAgent(context, input.report.timestamp, input.model);
  const suggestions = actionSuggestions(context.reports, processing.severityAssessment, processing.conflictResult.requiresHumanReview);
  // actionSuggestions can produce the same action type from more than one
  // branch. For example, a high-severity security incident with uncertain
  // contractor verification suggests NOTIFY_SECURITY both from the
  // safety-evidence branch and from the contractor-verification branch.
  // The policy engine correctly suppresses the second one as a duplicate,
  // but keeping both in the results array shows the same action twice in
  // the Action History view. Deduplicate by action type, keeping the first
  // occurrence so the order and the highest-level reason are preserved.
  const seenActionTypes = new Set<string>();
  const proposalInputs: { actionType: ActionProposal["actionType"]; reason: string }[] = [];
  for (const suggestion of suggestions) {
    if (seenActionTypes.has(suggestion.actionType)) continue;
    seenActionTypes.add(suggestion.actionType);
    proposalInputs.push(suggestion);
  }
  if (agent.decision.actionProposal && !seenActionTypes.has(agent.decision.actionProposal.actionType)) {
    proposalInputs.push({ actionType: agent.decision.actionProposal.actionType, reason: agent.decision.actionProposal.reason });
  }
  let actionState: ActionState = state.actionState;
  const actionResults: OrchestrationActionResult[] = [];
  for (const suggestion of proposalInputs) {
    if (!incidentId || processing.correlationResult.decision === "DUPLICATE_REPORT" || processing.correlationResult.matchStatus === "AMBIGUOUS") continue;
    const proposal = createActionProposal({ incidentId, actionType: suggestion.actionType, reason: suggestion.reason, requestedBy: agent.decision.actionProposal?.actionType === suggestion.actionType ? "AGENT" : "ORCHESTRATOR", evidenceReportIds: context.rawEvidenceReportIds, createdAt: input.report.timestamp, idempotencyKey: `${incidentId}:${suggestion.actionType}` });
    const policy = submitActionProposal(proposal, { incidentExists: context.incidentExists, incidentId, incidentState: freshRecord?.currentState ?? "CREATED", severity: context.severity, conflictResult: context.currentConflict, reports: context.reports, correlationDecision: context.correlationDecision, correlationMatchStatus: context.correlationMatchStatus, credibleResolutionEvidence: context.credibleResolutionEvidence }, actionState);
    actionState = policy.state;
    let execution = null;
    if (policy.policy.decision === "APPROVED") {
      const result = executeApprovedAction(proposal.actionId, actionState);
      actionState = result.state;
      execution = result.result;
    }
    actionResults.push({ proposal, decision: policy.policy, execution });
  }
  const auditEvents = agent.auditEvents.map((event, index) => ({ eventType: event.eventType, incidentId, reportId: input.report.report_id, actor: "ORCHESTRATOR" as const, details: event.details, sequence: index + 1 }));
  return { report: processing.normalizedReport, incidentId, processing: { ...processing, lifecycleState }, lifecycleBefore, lifecycleIntent: intent, lifecycleResults, lifecycleState, agentDecision: agent.decision, agent, actionProposals: actionResults.map((result) => result.proposal), actionResults, executedActions: actionResults.flatMap((result) => result.execution ? [result.execution] : []), suppressedActions: actionResults.filter((result) => result.decision.decision === "SUPPRESSED").map((result) => result.decision), humanReviewRequired: context.humanReviewRequired || actionResults.some((result) => result.decision.requiresHumanReview), auditEvents, errors: processing.issues.map((issue) => issue.message), state: { correlationState: processing.correlationState, severityState: processing.severityState, conflictState: processing.conflictState, lifecycleState, actionState } };
}