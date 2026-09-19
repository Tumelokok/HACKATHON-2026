import type { CorrelationResult } from "@/domain/correlation";
import type { ConflictResult } from "@/domain/conflicts";
import type { SeverityAssessment } from "@/domain/severity";
import type { NormalizedReport } from "@/types/report";

export type IncidentState =
  | "CREATED"
  | "ASSESSING"
  | "ACTIVE"
  | "RESPONDING"
  | "MONITORING"
  | "ESCALATED"
  | "RESOLVED"
  | "CANCELLED";

export type LifecycleActor = "RULE_ENGINE" | "APPLICATION" | "HUMAN";

export interface LifecycleEvidence {
  reports: readonly NormalizedReport[];
  correlationResult: CorrelationResult;
  severityAssessment: SeverityAssessment | null;
  conflictResult: ConflictResult | null;
}

export interface LifecycleTransitionRequest {
  incidentId: string;
  fromState: IncidentState;
  requestedState: IncidentState;
  reason: string;
  triggeringReportId?: string;
  actor: LifecycleActor;
  requestedAt: string;
  evidence: LifecycleEvidence;
}

export type LifecycleTransitionIntent = Omit<
  LifecycleTransitionRequest,
  "incidentId" | "evidence"
>;

export interface LifecycleTransitionEntry {
  transitionId: string;
  incidentId: string;
  fromState: IncidentState;
  toState: IncidentState;
  reason: string;
  triggeringReportId: string | null;
  actor: LifecycleActor;
  sequence: number;
  createdAt: string;
  evidenceReportIds: readonly string[];
}

interface LifecycleTransitionResultBase {
  fromState: IncidentState;
  requestedState: IncidentState;
  resultingState: IncidentState;
  reason: string;
  triggeringReportId: string | null;
  actor: LifecycleActor;
  requiresHumanReview: boolean;
  transitionId: string | null;
  evidenceReportIds: readonly string[];
}

export interface AcceptedLifecycleTransition extends LifecycleTransitionResultBase {
  accepted: true;
  resultingState: IncidentState;
  transition: LifecycleTransitionEntry;
}

export interface RejectedLifecycleTransition extends LifecycleTransitionResultBase {
  accepted: false;
  resultingState: IncidentState;
  transition: null;
}

export type LifecycleTransitionResult =
  | AcceptedLifecycleTransition
  | RejectedLifecycleTransition;

export interface LifecycleRecord {
  incidentId: string;
  currentState: IncidentState;
  history: readonly LifecycleTransitionEntry[];
}

export interface LifecycleState {
  records: readonly LifecycleRecord[];
}

export interface LifecycleProcessingResult {
  result: LifecycleTransitionResult;
  state: LifecycleState;
}