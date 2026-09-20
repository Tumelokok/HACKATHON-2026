import type { RawReportInput } from "@/types/report";
import type { AgentRunResult } from "@/domain/agent";
import type { ActionExecutionResult, ActionPolicyEvaluation, ActionState } from "@/domain/actions";
import type { ConflictResult } from "@/domain/conflicts";
import type { CorrelationResult } from "@/domain/correlation";
import type { LifecycleState, LifecycleTransitionIntent, LifecycleTransitionResult } from "@/domain/lifecycle";
import type { SeverityAssessment, SeverityState } from "@/domain/severity";
import type { ReportProcessingResult } from "@/domain/processing/reportProcessing";

export interface ReplayInput {
  report: RawReportInput;
  lifecycleIntent?: LifecycleTransitionIntent;
}

export interface ReplayAssertion {
  rubricArea: "incident-correlation" | "actions-services" | "severity" | "lifecycle" | "conflict-handling" | "duplicate-avoidance" | "safety" | "resolution";
  requirement: string;
  passed: boolean;
  evidence: readonly string[];
}

export interface ReplayScenario {
  name: string;
  description: string;
  inputs: readonly ReplayInput[];
  assertions: readonly ((trace: readonly ReplayReportResult[]) => readonly ReplayAssertion[])[];
}

export interface ReplayActionSnapshot {
  actionId: string;
  actionType: string;
  status: string;
  policy: ActionPolicyEvaluation | null;
  execution: ActionExecutionResult | null;
}

export interface ReplayIncidentSnapshot {
  incidentId: string | null;
  reportIds: readonly string[];
  lifecycleState: LifecycleState;
  severity: SeverityAssessment | null;
  severityHistory: SeverityState;
  conflict: ConflictResult;
  actionState: ActionState;
}

export interface ReplayReportResult {
  processingOrder: number;
  reportId: string;
  rawReport: RawReportInput;
  normalizedReport: ReportProcessingResult["normalizedReport"];
  validationPassed: boolean;
  validationIssues: ReportProcessingResult["issues"];
  correlation: CorrelationResult;
  incidentId: string | null;
  duplicate: boolean;
  severity: SeverityAssessment | null;
  conflicts: ConflictResult;
  lifecycle: readonly LifecycleTransitionResult[];
  lifecycleState: LifecycleState;
  actions: readonly ReplayActionSnapshot[];
  agent: AgentRunResult;
  auditEvents: readonly string[];
  errors: readonly string[];
}

export interface ReplaySummary {
  reportsProcessed: number;
  incidentsCreated: number;
  duplicatesDetected: number;
  conflictsDetected: number;
  humanReviewsRequested: number;
  actionsProposed: number;
  actionsExecuted: number;
  actionsSuppressed: number;
  resolvedIncidents: number;
  reopenedIncidents: number;
}

export interface ReplayEvaluation {
  scenario: string;
  passed: boolean;
  summary: ReplaySummary;
  assertions: readonly ReplayAssertion[];
  trace: readonly ReplayReportResult[];
  errors: readonly string[];
}