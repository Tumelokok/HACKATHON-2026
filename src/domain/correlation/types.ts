import type { NormalizedReport } from "@/types/report";

export type CorrelationDecision =
  | "NEW_INCIDENT"
  | "EXISTING_INCIDENT"
  | "DUPLICATE_REPORT";

export type CorrelationMatchStatus = "MATCHED" | "NO_MATCH" | "AMBIGUOUS";

export interface CandidateIncident {
  incidentId: string;
  locationNormalized: string;
  categoryNormalized: string;
  reportIds: readonly string[];
  reports: readonly NormalizedReport[];
  lastProcessingOrder: number;
}

export type CorrelationComponentName =
  | "location"
  | "category"
  | "description"
  | "context"
  | "activity";

export interface CorrelationComponentScore {
  name: CorrelationComponentName;
  score: number;
  weight: number;
  weightedScore: number;
  reason: string;
}

export interface CorrelationEvidence {
  components: readonly CorrelationComponentScore[];
  totalScore: number;
  reasons: readonly string[];
}

export interface CandidateIncidentScore {
  candidate: CandidateIncident;
  evidence: CorrelationEvidence;
}

export interface DuplicateInformation {
  originalReportId: string;
  originalIncidentId: string | null;
  reason: string;
}

export interface HumanReviewRequirement {
  required: boolean;
  reason: string | null;
  candidateIncidentIds: readonly string[];
}

export interface CorrelationConflictSignal {
  type: "CONTRADICTORY_EVIDENCE";
  reportIds: readonly [string, string];
  incidentId: string;
  reason: string;
}

export interface CorrelationResult {
  reportId: string;
  decision: CorrelationDecision;
  matchStatus: CorrelationMatchStatus;
  incidentId: string | null;
  confidence: number;
  evidence: CorrelationEvidence;
  candidateScores: readonly CandidateIncidentScore[];
  duplicate: DuplicateInformation | null;
  humanReview: HumanReviewRequirement;
  conflict: CorrelationConflictSignal | null;
}

export interface ProcessedCorrelationReport {
  report: NormalizedReport;
  incidentId: string | null;
  duplicateOfReportId: string | null;
  candidateIncidentIds: readonly string[];
}

export interface CorrelationState {
  processedReports: readonly ProcessedCorrelationReport[];
  incidents: readonly CandidateIncident[];
}

export interface CorrelationProcessingResult {
  result: CorrelationResult;
  state: CorrelationState;
}