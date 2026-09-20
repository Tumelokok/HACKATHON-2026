// Translates internal domain outputs into the external JSONL vocabulary
// required by the Technical and Submission Guide.
//
// This file must not import from outside src/domain/. It is a pure
// translation layer: given an OrchestrationResult, it produces a Prediction.

import type { OrchestrationResult } from "@/domain/orchestration";
import type { LifecycleTransitionResult } from "@/domain/lifecycle";
import type { ActionType } from "@/domain/actions";
import type {
  PredictedAction,
  PredictedIncidentStatus,
  PredictedRelationship,
  PredictedSeverity,
  Prediction,
} from "./types";
import {
  serviceForAction,
  serviceForCategory,
  secondaryServicesForCategory,
  type ServiceId,
} from "./serviceRouter";

function toSeverity(
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
): PredictedSeverity {
  // Domain severity and brief severity share the same four labels.
  return level;
}

function hasResolutionTransition(
  transitions: readonly LifecycleTransitionResult[],
): boolean {
  return transitions.some(
    (t) => t.accepted && t.resultingState === "RESOLVED",
  );
}

function transitionedFromResolved(
  transitions: readonly LifecycleTransitionResult[],
): boolean {
  return transitions.some((t) => t.accepted && t.fromState === "RESOLVED");
}

function toRelationship(
  result: OrchestrationResult,
  transitions: readonly LifecycleTransitionResult[],
): PredictedRelationship {
  const correlation = result.processing.correlationResult;

  if (correlation.decision === "DUPLICATE_REPORT") return "DUPLICATE";

  if (correlation.decision === "NEW_INCIDENT") return "NEW";

  // Existing incident. Now we decide between UPDATE / CORROBORATION /
  // CONFLICT / RESOLUTION. Priority order is deliberate:
  // RESOLUTION > CONFLICT > UPDATE > CORROBORATION.
  //
  // A RESOLUTION relationship is recorded when either:
  //  (a) the lifecycle engine actually transitioned to RESOLVED in this cycle, or
  //  (b) the orchestrator attempted a RESOLVE intent on this report, even if
  //      the lifecycle engine refused because an open conflict requires
  //      human review. The attempt itself is the resolution evidence.
    const attemptedResolve = result.lifecycleIntent === "RESOLVE";

  if (
    hasResolutionTransition(transitions) ||
    transitionedFromResolved(transitions) ||
    attemptedResolve
  ) {
    return "RESOLUTION";
  }

  const conflictExists =
    result.processing.conflictResult.conflictExists ||
    correlation.conflict !== null;
  if (conflictExists) return "CONFLICT";

  const severityChanged = transitions.length > 0;
  if (severityChanged) return "UPDATE";

  return "CORROBORATION";
}

function toIncidentStatus(
  result: OrchestrationResult,
): PredictedIncidentStatus {
  const incidentId = result.incidentId;
  if (!incidentId) return "INVESTIGATING";

  const record = result.lifecycleState.records.find(
    (r) => r.incidentId === incidentId,
  );
  const state = record?.currentState;

  switch (state) {
    case "CREATED":
    case "ASSESSING":
      return "INVESTIGATING";
    case "ACTIVE":
    case "RESPONDING":
      return "ACTIVE";
    case "ESCALATED":
      return "ESCALATED";
    case "MONITORING":
      return "CONTROLLED";
    case "RESOLVED":
    case "CANCELLED":
      return "RESOLVED";
    default:
      return "INVESTIGATING";
  }
}

function toConfidence(result: OrchestrationResult): number {
  // Prefer correlation confidence for NEW/DUPLICATE, severity confidence
  // for existing incidents. Both are bounded 0..1 in the domain.
  const correlation = result.processing.correlationResult;
  const severity = result.processing.severityAssessment;

  const raw =
    correlation.decision === "NEW_INCIDENT"
      ? severity?.confidence ?? correlation.confidence
      : correlation.confidence;

  // Clamp defensively. The brief requires 0..1.
  return Math.max(0, Math.min(1, raw));
}

function executedActionsForThisReport(
  result: OrchestrationResult,
): readonly { actionType: ActionType }[] {
  // actionResults only contains actions proposed during this report cycle.
  return result.actionResults
    .filter((r) => r.decision.decision === "APPROVED")
    .map((r) => ({ actionType: r.proposal.actionType }));
}

function previouslyExecutedServiceIds(
  result: OrchestrationResult,
  incidentId: string | null,
): ReadonlySet<ServiceId> {
  const ids = new Set<ServiceId>();
  if (!incidentId) return ids;

  for (const record of result.state.actionState.records) {
    if (record.proposal.incidentId !== incidentId) continue;
    if (record.status !== "EXECUTED") continue;
    const service = serviceForAction(record.proposal.actionType);
    if (service) ids.add(service);
  }
  return ids;
}

function toActions(result: OrchestrationResult): PredictedAction[] {
  const actions: PredictedAction[] = [];
  const incidentId = result.incidentId;
  const category = result.report.categoryNormalized;
  const severity =
    result.processing.severityAssessment?.level ?? "LOW";

  const proposedThisReport = executedActionsForThisReport(result);
  const alreadyExecuted = previouslyExecutedServiceIds(result, incidentId);

  // 1. Actions proposed and approved during this report cycle.
  for (const { actionType } of proposedThisReport) {
    const serviceId = serviceForAction(actionType);

    // CONTINUE_RESPONSE when we are re-dispatching to a service we have
    // already dispatched before.
    if (serviceId && alreadyExecuted.has(serviceId)) {
      actions.push({ type: "CONTINUE_RESPONSE", service_id: serviceId });
      continue;
    }

    const mapped = mapActionType(actionType);
    const action: PredictedAction = mapped.serviceId
      ? { type: mapped.type, service_id: mapped.serviceId }
      : { type: mapped.type };

    if (serviceId && !action.service_id) {
      action.service_id = serviceId;
    }
    actions.push(action);
  }

  // 2. Category-driven dispatch for the primary service, if we have not
  //    already dispatched it and the incident is active or escalating.
  const primaryService = serviceForCategory(category);
  const status = toIncidentStatus(result);
  const activeStatus = status === "ACTIVE" || status === "ESCALATED";

  if (
    primaryService &&
    activeStatus &&
    !alreadyExecuted.has(primaryService) &&
    !actions.some((a) => a.service_id === primaryService)
  ) {
    actions.push({ type: "DISPATCH", service_id: primaryService });
  }

  // 3. Secondary services for high-severity incidents.
  if (activeStatus) {
    for (const secondary of secondaryServicesForCategory(category, severity)) {
      if (
        !alreadyExecuted.has(secondary) &&
        !actions.some((a) => a.service_id === secondary)
      ) {
        actions.push({ type: "NOTIFY", service_id: secondary });
      }
    }
  }

  // 4. If we still have no action, mark NO_NEW_ACTION explicitly.
  if (actions.length === 0) {
    actions.push({ type: "NO_NEW_ACTION" });
  }

  return actions;
}

function mapActionType(
  actionType: ActionType,
): { type: PredictedAction["type"]; serviceId?: ServiceId } {
  switch (actionType) {
    case "NOTIFY_SECURITY":
      return { type: "DISPATCH", serviceId: "SVC-SECURITY" };
    case "NOTIFY_MAINTENANCE":
      return { type: "DISPATCH", serviceId: "SVC-FACILITIES" };
    case "NOTIFY_ICT":
      return { type: "DISPATCH", serviceId: "SVC-IT" };
    case "NOTIFY_TRUSTED_CONTACT":
      return { type: "NOTIFY" };
    case "REQUEST_LOCATION":
      return { type: "REQUEST_INSPECTION" };
    case "REQUEST_HUMAN_REVIEW":
      return { type: "REQUEST_VERIFICATION" };
    case "ESCALATE_INCIDENT":
      return { type: "ESCALATE_RESPONSE" };
    case "CLOSE_INCIDENT":
      return { type: "CLOSE_INCIDENT" };
  }
}

export function toPrediction(result: OrchestrationResult): Prediction {
  const relationship = toRelationship(result, result.lifecycleResults);
  const severity = toSeverity(
    result.processing.severityAssessment?.level ?? "LOW",
  );
  const incidentStatus = toIncidentStatus(result);
  const confidence = toConfidence(result);

  const humanReview =
    result.humanReviewRequired ||
    result.processing.correlationResult.humanReview.required ||
    result.processing.conflictResult.requiresHumanReview;

  const actions = toActions(result);

  return {
    report_id: result.report.report_id,
    incident_id: result.incidentId ?? `standalone-${result.report.report_id}`,
    relationship,
    severity,
    confidence,
    actions,
    incident_status: incidentStatus,
    human_review: humanReview,
  };
}