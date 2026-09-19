import type { CorrelationDecision, CorrelationMatchStatus } from "@/domain/correlation";
import type { ConflictResult } from "@/domain/conflicts";
import type { IncidentState } from "@/domain/lifecycle";
import type { SeverityLevel } from "@/domain/severity";
import type { NormalizedReport } from "@/types/report";

export const actionTypes = [
  "NOTIFY_SECURITY",
  "NOTIFY_MAINTENANCE",
  "NOTIFY_ICT",
  "NOTIFY_TRUSTED_CONTACT",
  "REQUEST_LOCATION",
  "REQUEST_HUMAN_REVIEW",
  "ESCALATE_INCIDENT",
  "CLOSE_INCIDENT",
] as const;

export type ActionType = (typeof actionTypes)[number];

export type ActionStatus =
  | "PROPOSED"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTED"
  | "FAILED"
  | "SUPPRESSED";

export type PolicyDecision = "APPROVED" | "REJECTED" | "SUPPRESSED";

export type ActionAuditEventType =
  | "ACTION_PROPOSED"
  | "ACTION_APPROVED"
  | "ACTION_REJECTED"
  | "ACTION_SUPPRESSED"
  | "ACTION_EXECUTED"
  | "ACTION_FAILED"
  | "HUMAN_REVIEW_REQUESTED";

export interface ActionProposalInput {
  incidentId: string;
  actionType: ActionType;
  reason: string;
  requestedBy: string;
  evidenceReportIds: readonly string[];
  createdAt: string;
  idempotencyKey?: string;
  allowRepeat?: boolean;
  repeatJustification?: string;
}

export interface ActionProposal extends ActionProposalInput {
  actionId: string;
  status: "PROPOSED";
  idempotencyKey: string;
}

export interface ActionPolicyContext {
  incidentExists: boolean;
  incidentId: string;
  incidentState: IncidentState;
  severity: SeverityLevel | null;
  conflictResult: ConflictResult | null;
  reports: readonly NormalizedReport[];
  correlationDecision: CorrelationDecision;
  correlationMatchStatus: CorrelationMatchStatus;
  credibleResolutionEvidence: boolean;
}

export interface ActionPolicyEvaluation {
  actionId: string;
  decision: PolicyDecision;
  status: Exclude<ActionStatus, "PROPOSED" | "EXECUTED" | "FAILED">;
  reason: string;
  requiresHumanReview: boolean;
  approvedBy: "POLICY_ENGINE" | null;
}

export interface ActionAuditEvent {
  auditId: string;
  eventType: ActionAuditEventType;
  incidentId: string;
  actionId: string;
  reportId: string | null;
  actor: string;
  details: string;
  sequence: number;
  createdAt: string;
}

export interface ActionExecutionResult {
  actionId: string;
  status: "EXECUTED" | "FAILED";
  executed: boolean;
  simulated: true;
  result: string | null;
  failureReason: string | null;
  auditEvent: ActionAuditEvent | null;
}

export interface ActionRecord {
  proposal: ActionProposal;
  status: ActionStatus;
  policy: ActionPolicyEvaluation | null;
  execution: ActionExecutionResult | null;
}

export interface ActionState {
  records: readonly ActionRecord[];
  auditEvents: readonly ActionAuditEvent[];
}

export interface ActionProcessingResult {
  proposal: ActionProposal;
  policy: ActionPolicyEvaluation;
  state: ActionState;
}

export interface ActionExecutionOptions {
  shouldFail?: boolean;
  failureReason?: string;
}