import type { RawReportInput } from "@/types/report";
import type {
  PredictedIncidentStatus,
  PredictedRelationship,
  PredictedSeverity,
} from "@/output/types";

export type SceneName =
  | "NETWORK_OUTAGE"
  | "SMOKE_ELECTRICAL"
  | "CONTRACTOR_VERIFICATION"
  | "LIFT_ACCESSIBILITY"
  | "OTHER";

export interface DashboardNormalizedReport {
  locationNormalized: string;
  categoryNormalized: string;
  reportedSeverityNormalized: string;
  reporterTypeNormalized: string;
  timestampParsed: string | null;
}

export interface DashboardCorrelationSummary {
  decision: string;
  matchStatus: string;
  confidence: number;
}

export interface DashboardConflictSummary {
  conflictExists: boolean;
  conflictType: string | null;
  involvedReportIds: readonly string[];
  requiresHumanReview: boolean;
}

export interface DashboardLifecycleTransition {
  accepted: boolean;
  fromState: string;
  requestedState: string;
  resultingState: string;
  reason: string;
}

export interface DashboardAction {
  type: string;
  service_id: string | null;
  status: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED" | "SUPPRESSED";
  policyDecision: "APPROVED" | "REJECTED" | "SUPPRESSED" | null;
  policyReason: string | null;
  executionStatus: "EXECUTED" | "FAILED" | null;
  executionResult: string | null;
  failureReason: string | null;
}

export interface DashboardReport {
  report_id: string;
  processingOrder: number;
  incident_id: string;
  relationship: PredictedRelationship;
  severity: PredictedSeverity;
  severityConfidence: number;
  correlationConfidence: number;
  actions: readonly DashboardAction[];
  incident_status: PredictedIncidentStatus;
  human_review: boolean;
  scene: SceneName;
  raw: RawReportInput;
  normalized: DashboardNormalizedReport;
  correlation: DashboardCorrelationSummary;
  conflicts: DashboardConflictSummary;
  lifecycleTransitions: readonly DashboardLifecycleTransition[];
}

export interface DashboardIncident {
  incident_id: string;
  scene: SceneName;
  category: string;
  location: string;
  currentSeverity: PredictedSeverity;
  currentStatus: PredictedIncidentStatus;
  currentConfidence: number;
  services: readonly string[];
  human_review: boolean;
  reportIds: string[];
  firstProcessingOrder: number;
}

export interface DashboardData {
  generatedAt: string;
  reports: readonly DashboardReport[];
  incidents: readonly DashboardIncident[];
}