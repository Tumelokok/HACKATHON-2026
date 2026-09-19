import type {
  ActionAuditEvent,
  ActionProposal,
  ActionRecord,
  ActionState,
  ActionType,
} from "@/domain/actions";
import type { CorrelationResult } from "@/domain/correlation";
import type { ConflictRecord, ConflictResult } from "@/domain/conflicts";
import type {
  IncidentState,
  LifecycleTransitionIntent,
} from "@/domain/lifecycle";
import type { SeverityAssessment, SeverityLevel } from "@/domain/severity";
import type { NormalizedReport } from "@/types/report";

export type AgentDecisionType =
  | "NO_ACTION"
  | "PROPOSE_ACTION"
  | "REQUEST_HUMAN_REVIEW"
  | "REQUEST_MORE_INFORMATION"
  | "ESCALATE"
  | "PROPOSE_CLOSURE";

export type AgentToolName =
  | "get_incident"
  | "update_incident"
  | "assess_risk"
  | "notify_security"
  | "notify_trusted_contact"
  | "request_location"
  | "close_incident";

export interface AgentContext {
  incidentId: string | null;
  incidentExists: boolean;
  incidentState: IncidentState | null;
  severity: SeverityLevel | null;
  severityConfidence: number | null;
  correlationConfidence: number;
  correlationDecision: CorrelationResult["decision"];
  correlationMatchStatus: CorrelationResult["matchStatus"];
  reports: readonly NormalizedReport[];
  normalizedEvidence: readonly NormalizedReport[];
  rawEvidenceReportIds: readonly string[];
  conflicts: readonly ConflictRecord[];
  currentConflict: ConflictResult | null;
  lifecycleHistory: readonly import("@/domain/lifecycle").LifecycleTransitionEntry[];
  previousActions: readonly ActionRecord[];
  actionHistory: readonly ActionAuditEvent[];
  humanReviewRequired: boolean;
  credibleResolutionEvidence: boolean;
  processingOrder: number;
}

export interface AgentObservation {
  observationId: string;
  observedAt: string;
  context: AgentContext;
  evidenceReportIds: readonly string[];
}

export interface AgentActionProposal extends ActionProposal {
  requestedBy: "AGENT";
  confidence: number;
}

export type AgentToolRequest =
  | { tool: "get_incident"; input: { incidentId: string } }
  | { tool: "update_incident"; input: { incidentId: string; intent: LifecycleTransitionIntent } }
  | { tool: "assess_risk"; input: { incidentId: string } }
  | { tool: "notify_security"; input: { incidentId: string; reason: string; evidenceReportIds: readonly string[] } }
  | { tool: "notify_trusted_contact"; input: { incidentId: string; reason: string; evidenceReportIds: readonly string[] } }
  | { tool: "request_location"; input: { incidentId: string; reason: string; evidenceReportIds: readonly string[] } }
  | { tool: "close_incident"; input: { incidentId: string; reason: string; evidenceReportIds: readonly string[] } };

export interface AgentDecision {
  decisionType: AgentDecisionType;
  confidence: number;
  reason: string;
  evidenceReportIds: readonly string[];
  actionProposal: AgentActionProposal | null;
  toolRequest: AgentToolRequest | null;
  fallbackUsed: boolean;
  modelOutputAccepted: boolean;
}

export type AgentAuditEventType =
  | "AGENT_OBSERVED"
  | "AGENT_DECIDED"
  | "AGENT_PROPOSAL_GENERATED"
  | "MODEL_OUTPUT_REJECTED"
  | "AGENT_FALLBACK_USED"
  | "HUMAN_REVIEW_REQUESTED"
  | "AGENT_ACTION_REJECTED"
  | "DUPLICATE_ACTION_SUPPRESSED";

export interface AgentAuditEvent {
  auditId: string;
  eventType: AgentAuditEventType;
  incidentId: string | null;
  actionId: string | null;
  actor: "AGENT" | "AGENT_POLICY";
  details: string;
  evidenceReportIds: readonly string[];
  sequence: number;
  createdAt: string;
}

export interface AgentRunResult {
  observation: AgentObservation;
  decision: AgentDecision;
  auditEvents: readonly AgentAuditEvent[];
}

export interface AgentModelRequest {
  observation: AgentObservation;
  policyBoundary: string;
}

export interface AgentModel {
  generateDecision(request: AgentModelRequest): unknown;
}

export interface ValidatedModelOutput {
  decisionType: AgentDecisionType;
  confidence: number;
  reason: string;
  actionType: ActionType | null;
  toolName: AgentToolName | null;
  evidenceReportIds: readonly string[];
}

export interface AgentContextInput {
  incidentId: string | null;
  incidentExists: boolean;
  lifecycleState: IncidentState | null;
  lifecycleHistory: readonly import("@/domain/lifecycle").LifecycleTransitionEntry[];
  correlationResult: CorrelationResult;
  severityAssessment: SeverityAssessment | null;
  reports: readonly NormalizedReport[];
  conflictRecords: readonly ConflictRecord[];
  conflictResult: ConflictResult | null;
  actionState: ActionState;
  credibleResolutionEvidence: boolean;
  processingOrder: number;
}