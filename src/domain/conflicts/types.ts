import type { CorrelationResult } from "@/domain/correlation";
import type { SeverityAssessment } from "@/domain/severity";
import type { NormalizedReport } from "@/types/report";

export type ConflictType =
  | "SEVERITY_CONTRADICTION"
  | "STATE_CONTRADICTION"
  | "FACTUAL_CONTRADICTION"
  | "LOCATION_CONTRADICTION"
  | "CATEGORY_CONTRADICTION";

export type ConflictStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";

export interface ConflictSignal {
  type: ConflictType;
  reportIds: readonly [string, string];
  confidence: number;
  explanation: string;
  requiresHumanReview: boolean;
}

export interface ConflictResult {
  conflictExists: boolean;
  conflictId: string | null;
  duplicateOfConflictId: string | null;
  conflictType: ConflictType | null;
  incidentId: string | null;
  involvedReportIds: readonly string[];
  evidenceReports: readonly NormalizedReport[];
  signals: readonly ConflictSignal[];
  confidence: number;
  explanation: string;
  requiresHumanReview: boolean;
  status: ConflictStatus | null;
  isDuplicate: boolean;
}

export interface ConflictInput {
  incidentId: string | null;
  reports: readonly NormalizedReport[];
  correlationResult: CorrelationResult;
  severityAssessment: SeverityAssessment | null;
  assessedAt: string;
}

export interface ConflictRecord {
  conflictId: string;
  result: ConflictResult;
  createdAt: string;
}

export interface ConflictState {
  records: readonly ConflictRecord[];
}

export interface ConflictProcessingResult {
  result: ConflictResult;
  state: ConflictState;
}