export {
  CORRELATION_CONFIG,
  applyCorrelationResult,
  correlateReport,
  createCorrelationState,
  processCorrelatedReport,
} from "./correlationEngine";
export type {
  CandidateIncident,
  CandidateIncidentScore,
  CorrelationComponentName,
  CorrelationComponentScore,
  CorrelationConflictSignal,
  CorrelationDecision,
  CorrelationEvidence,
  CorrelationMatchStatus,
  CorrelationProcessingResult,
  CorrelationResult,
  CorrelationState,
  DuplicateInformation,
  HumanReviewRequirement,
  ProcessedCorrelationReport,
} from "./types";