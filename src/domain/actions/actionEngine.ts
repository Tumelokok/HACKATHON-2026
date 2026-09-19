import {
  evaluateActionProposal,
} from "./actionPolicy";
import type {
  ActionAuditEvent,
  ActionPolicyContext,
  ActionProcessingResult,
  ActionProposal,
  ActionProposalInput,
  ActionRecord,
  ActionState,
} from "./types";

export function createActionState(): ActionState {
  return { records: [], auditEvents: [] };
}

export function createActionProposal(input: ActionProposalInput): ActionProposal {
  const idempotencyKey = input.idempotencyKey ?? `${input.incidentId}:${input.actionType}`;
  return {
    ...input,
    actionId: `action-${input.incidentId}-${input.actionType}-${idempotencyKey}`,
    idempotencyKey,
    status: "PROPOSED",
  };
}

function audit(
  proposal: ActionProposal,
  state: ActionState,
  eventType: ActionAuditEvent["eventType"],
  actor: string,
  details: string,
): ActionAuditEvent {
  return {
    auditId: `audit-${proposal.actionId}-${state.auditEvents.length + 1}-${eventType}`,
    eventType,
    incidentId: proposal.incidentId,
    actionId: proposal.actionId,
    reportId: proposal.evidenceReportIds[0] ?? null,
    actor,
    details,
    sequence: state.auditEvents.length + 1,
    createdAt: proposal.createdAt,
  };
}

export function submitActionProposal(
  proposal: ActionProposal,
  context: ActionPolicyContext,
  state: ActionState,
): ActionProcessingResult {
  const proposalAudit = audit(
    proposal,
    state,
    "ACTION_PROPOSED",
    proposal.requestedBy,
    proposal.reason.trim(),
  );
  const withProposalAudit: ActionState = {
    records: state.records,
    auditEvents: [...state.auditEvents, proposalAudit],
  };
  const policy = evaluateActionProposal(proposal, context, state.records);
  const policyEventType = policy.decision === "APPROVED"
    ? "ACTION_APPROVED"
    : policy.decision === "SUPPRESSED"
      ? "ACTION_SUPPRESSED"
      : "ACTION_REJECTED";
  const policyAudit = audit(proposal, withProposalAudit, policyEventType, policy.approvedBy ?? "POLICY_ENGINE", policy.reason);
  const humanReviewAudit = policy.requiresHumanReview
    ? audit(proposal, { ...withProposalAudit, auditEvents: [...withProposalAudit.auditEvents, policyAudit] }, "HUMAN_REVIEW_REQUESTED", "POLICY_ENGINE", policy.reason)
    : null;
  const record: ActionRecord = {
    proposal,
    status: policy.status,
    policy,
    execution: null,
  };
  const auditEvents = [
    ...withProposalAudit.auditEvents,
    policyAudit,
    ...(humanReviewAudit ? [humanReviewAudit] : []),
  ];
  return {
    proposal,
    policy,
    state: {
      records: [...state.records, record],
      auditEvents,
    },
  };
}