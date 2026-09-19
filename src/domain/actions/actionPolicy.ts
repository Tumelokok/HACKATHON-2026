import type { IncidentState } from "@/domain/lifecycle";
import {
  actionTypes,
  type ActionPolicyContext,
  type ActionPolicyEvaluation,
  type ActionProposal,
  type ActionRecord,
} from "./types";

export const ACTION_POLICY_MATRIX: Readonly<Record<ActionProposal["actionType"], {
  allowedStates: readonly IncidentState[];
}>> = {
  NOTIFY_SECURITY: { allowedStates: ["ASSESSING", "ACTIVE", "RESPONDING", "ESCALATED"] },
  NOTIFY_MAINTENANCE: { allowedStates: ["ASSESSING", "ACTIVE", "RESPONDING", "ESCALATED"] },
  NOTIFY_ICT: { allowedStates: ["ASSESSING", "ACTIVE", "RESPONDING", "ESCALATED"] },
  NOTIFY_TRUSTED_CONTACT: { allowedStates: ["ACTIVE", "RESPONDING", "ESCALATED"] },
  REQUEST_LOCATION: { allowedStates: ["CREATED", "ASSESSING", "ACTIVE", "MONITORING", "ESCALATED"] },
  REQUEST_HUMAN_REVIEW: { allowedStates: ["CREATED", "ASSESSING", "ACTIVE", "RESPONDING", "MONITORING", "ESCALATED", "RESOLVED"] },
  ESCALATE_INCIDENT: { allowedStates: ["ASSESSING", "ACTIVE", "RESPONDING", "MONITORING", "RESOLVED"] },
  CLOSE_INCIDENT: { allowedStates: ["ACTIVE", "RESPONDING", "MONITORING", "ESCALATED"] },
};

function hasKeyword(context: ActionPolicyContext, keywords: readonly string[]): boolean {
  return context.reports.some((report) => {
    const description = report.descriptionRaw.toLowerCase();
    return keywords.some((keyword) => description.includes(keyword));
  });
}

function isSevere(context: ActionPolicyContext): boolean {
  return context.severity === "HIGH" || context.severity === "CRITICAL";
}

function isSecurityApplicable(context: ActionPolicyContext): boolean {
  return (
    ["FIRE", "SMOKE", "SECURITY", "ELECTRICAL", "LIFT"].includes(
      context.reports[0]?.categoryNormalized ?? "",
    ) ||
    isSevere(context) ||
    hasKeyword(context, ["danger", "threat", "trapped", "fire", "smoke"])
  );
}

function isMaintenanceApplicable(context: ActionPolicyContext): boolean {
  return (
    ["ELECTRICAL", "LIFT", "WATER_LEAK"].includes(
      context.reports[0]?.categoryNormalized ?? "",
    ) ||
    hasKeyword(context, ["repair", "panel", "leak", "lift", "maintenance"])
  );
}

function isIctApplicable(context: ActionPolicyContext): boolean {
  return (
    context.reports.some((report) => report.categoryNormalized === "NETWORK_OUTAGE") ||
    hasKeyword(context, ["network", "wifi", "wi-fi", "outage", "system"])
  );
}

function isLocationMissing(context: ActionPolicyContext): boolean {
  return context.reports.length === 0 || context.reports.some((report) => {
    const location = report.locationNormalized;
    return location.length === 0 || ["unknown", "uncertain", "not provided"].includes(location);
  });
}

function equivalentExecutedAction(
  proposal: ActionProposal,
  records: readonly ActionRecord[],
): ActionRecord | undefined {
  return records.find(
    (record) =>
      record.proposal.incidentId === proposal.incidentId &&
      record.proposal.actionType === proposal.actionType &&
      record.status === "EXECUTED",
  );
}

function isActionType(value: string): value is ActionProposal["actionType"] {
  return actionTypes.includes(value as ActionProposal["actionType"]);
}

export function evaluateActionProposal(
  proposal: ActionProposal,
  context: ActionPolicyContext,
  records: readonly ActionRecord[],
): ActionPolicyEvaluation {
  if (!isActionType(proposal.actionType)) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "Action type is not supported by the controlled action policy.",
      requiresHumanReview: false,
      approvedBy: null,
    };
  }

  if (!context.incidentExists || context.incidentId !== proposal.incidentId) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "The target incident does not exist in the supplied application state.",
      requiresHumanReview: false,
      approvedBy: null,
    };
  }

  const matrix = ACTION_POLICY_MATRIX[proposal.actionType];
  if (!matrix.allowedStates.includes(context.incidentState)) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: `Action is not allowed while incident is ${context.incidentState}.`,
      requiresHumanReview: context.incidentState === "CANCELLED",
      approvedBy: null,
    };
  }

  if (context.correlationMatchStatus === "AMBIGUOUS" || context.correlationDecision === "DUPLICATE_REPORT") {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "Actions require a confirmed, nonduplicate incident association.",
      requiresHumanReview: true,
      approvedBy: null,
    };
  }

  const priorAction = equivalentExecutedAction(proposal, records);
  if (priorAction) {
    const justifiedRepeat =
      proposal.allowRepeat === true &&
      Boolean(proposal.repeatJustification?.trim()) &&
      proposal.idempotencyKey !== priorAction.proposal.idempotencyKey &&
      proposal.evidenceReportIds.length > 0;
    if (!justifiedRepeat) {
      return {
        actionId: proposal.actionId,
        decision: "SUPPRESSED",
        status: "SUPPRESSED",
        reason: "Equivalent action already executed for this incident.",
        requiresHumanReview: false,
        approvedBy: null,
      };
    }
  }

  if (context.conflictResult?.requiresHumanReview === true && proposal.actionType !== "REQUEST_HUMAN_REVIEW" && proposal.actionType !== "ESCALATE_INCIDENT") {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "An unresolved safety conflict requires human review before this action.",
      requiresHumanReview: true,
      approvedBy: null,
    };
  }

  if (proposal.actionType === "NOTIFY_SECURITY" && !isSecurityApplicable(context)) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "Security notification is not applicable to the supplied incident evidence.",
      requiresHumanReview: false,
      approvedBy: null,
    };
  }
  if (proposal.actionType === "NOTIFY_MAINTENANCE" && !isMaintenanceApplicable(context)) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "Maintenance notification is not applicable to the supplied incident evidence.",
      requiresHumanReview: false,
      approvedBy: null,
    };
  }
  if (proposal.actionType === "NOTIFY_ICT" && !isIctApplicable(context)) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "ICT notification is not applicable to the supplied incident evidence.",
      requiresHumanReview: false,
      approvedBy: null,
    };
  }
  if (proposal.actionType === "REQUEST_LOCATION" && !isLocationMissing(context)) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "A location is already available and does not require a location request.",
      requiresHumanReview: false,
      approvedBy: null,
    };
  }
  if (proposal.actionType === "NOTIFY_TRUSTED_CONTACT" && !isSevere(context)) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "Trusted-contact notification requires serious safety evidence.",
      requiresHumanReview: true,
      approvedBy: null,
    };
  }
  if (proposal.actionType === "ESCALATE_INCIDENT" && !isSevere(context) && context.conflictResult?.requiresHumanReview !== true) {
    return {
      actionId: proposal.actionId,
      decision: "REJECTED",
      status: "REJECTED",
      reason: "Escalation requires severe evidence or an unresolved safety conflict.",
      requiresHumanReview: true,
      approvedBy: null,
    };
  }
  if (proposal.actionType === "CLOSE_INCIDENT") {
    if (context.conflictResult?.requiresHumanReview === true || !context.credibleResolutionEvidence || isSevere(context)) {
      return {
        actionId: proposal.actionId,
        decision: "REJECTED",
        status: "REJECTED",
        reason: "Closing requires credible resolution evidence and no unresolved severe safety condition.",
        requiresHumanReview: true,
        approvedBy: null,
      };
    }
  }

  return {
    actionId: proposal.actionId,
    decision: "APPROVED",
    status: "APPROVED",
    reason: proposal.actionType === "REQUEST_HUMAN_REVIEW"
      ? "Human review is required or explicitly requested by the application."
      : "Action is applicable, state-valid, policy-safe, and not an inappropriate duplicate.",
    requiresHumanReview: proposal.actionType === "REQUEST_HUMAN_REVIEW",
    approvedBy: "POLICY_ENGINE",
  };
}