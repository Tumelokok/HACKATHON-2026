import type { AgentDecision, AgentModel, AgentRunResult } from "@/domain/agent";
import type { ActionExecutionResult, ActionPolicyEvaluation, ActionProposal, ActionState } from "@/domain/actions";
import type { ConflictState } from "@/domain/conflicts";
import type { CorrelationState } from "@/domain/correlation";
import type { IncidentState, LifecycleState, LifecycleTransitionResult } from "@/domain/lifecycle";
import type { ReportProcessingResult } from "@/domain/processing/reportProcessing";
import type { SeverityState } from "@/domain/severity";
import type { RawReportInput } from "@/types/report";

export type LifecycleIntent = "ASSESS" | "ACTIVATE" | "RESPOND" | "MONITOR" | "ESCALATE" | "RESOLVE" | "REOPEN" | "CANCEL";

export interface OrchestrationState {
  correlationState: CorrelationState;
  severityState: SeverityState;
  conflictState: ConflictState;
  lifecycleState: LifecycleState;
  actionState: ActionState;
}

export interface OrchestrationInput {
  report: RawReportInput;
  processingOrder: number;
  state?: Partial<OrchestrationState>;
  model?: AgentModel;
}

export interface OrchestrationActionResult {
  proposal: ActionProposal;
  decision: ActionPolicyEvaluation;
  execution: ActionExecutionResult | null;
}

export interface OrchestrationAuditEvent {
  eventType: string;
  incidentId: string | null;
  reportId: string;
  actor: "ORCHESTRATOR";
  details: string;
  sequence: number;
}

export interface OrchestrationResult {
  report: ReportProcessingResult["normalizedReport"];
  incidentId: string | null;
  processing: ReportProcessingResult;
  lifecycleBefore: IncidentState | null;
  lifecycleIntent: LifecycleIntent | null;
  lifecycleResults: readonly LifecycleTransitionResult[];
  lifecycleState: LifecycleState;
  agentDecision: AgentDecision;
  agent: AgentRunResult;
  actionProposals: readonly ActionProposal[];
  actionResults: readonly OrchestrationActionResult[];
  executedActions: readonly ActionExecutionResult[];
  suppressedActions: readonly ActionPolicyEvaluation[];
  humanReviewRequired: boolean;
  auditEvents: readonly OrchestrationAuditEvent[];
  errors: readonly string[];
  state: OrchestrationState;
}