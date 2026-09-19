import type { NormalizedReport } from "@/types/report";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SeverityAssessmentSource = "RULE_ENGINE";

export type AffectedPeopleLevel = "NONE" | "SOME" | "MANY";
export type OperationalImpactLevel = "NONE" | "LIMITED" | "WIDESPREAD" | "CRITICAL";

export interface SeverityContext {
  affectedPeople?: AffectedPeopleLevel;
  immediateDanger?: boolean;
  operationalImpact?: OperationalImpactLevel;
  escalationEvidence?: boolean;
  conflictEvidence?: boolean;
}

export interface SeverityConflictSignal {
  type: "CONTRADICTORY_SEVERITY_EVIDENCE";
  reportIds: readonly [string, string];
  reason: string;
}

export interface SeverityAssessment {
  incidentId: string;
  level: SeverityLevel;
  confidence: number;
  reason: string;
  evidenceReportIds: readonly string[];
  source: SeverityAssessmentSource;
  createdAt: string;
  conflict: SeverityConflictSignal | null;
  requiresHumanReview: boolean;
}

export interface SeverityInput {
  incidentId: string;
  reports: readonly NormalizedReport[];
  context?: SeverityContext;
  assessedAt: string;
}

export interface SeverityAssessmentResult {
  assessment: SeverityAssessment;
  evidenceReports: readonly NormalizedReport[];
}

export interface SeverityState {
  assessments: readonly SeverityAssessment[];
}

export interface SeverityProcessingResult extends SeverityAssessmentResult {
  state: SeverityState;
}