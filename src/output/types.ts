// JSONL contract types for the Campus Crisis Agent prediction output.
// This is the external vocabulary required by the Technical and Submission Guide.
// It is deliberately separate from the domain vocabulary in src/domain/.

export type PredictedRelationship =
  | "NEW"
  | "UPDATE"
  | "CORROBORATION"
  | "CONFLICT"
  | "DUPLICATE"
  | "RESOLUTION";

export type PredictedSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PredictedIncidentStatus =
  | "INVESTIGATING"
  | "ACTIVE"
  | "ESCALATED"
  | "CONTROLLED"
  | "RESOLVED";

export type PredictedActionType =
  | "DISPATCH"
  | "NOTIFY"
  | "REQUEST_INSPECTION"
  | "REQUEST_VERIFICATION"
  | "ESCALATE_RESPONSE"
  | "CONTINUE_RESPONSE"
  | "CREATE_TICKET"
  | "MONITOR"
  | "CLOSE_INCIDENT"
  | "NO_NEW_ACTION";

export interface PredictedAction {
  type: PredictedActionType;
  service_id?: string;
}

export interface Prediction {
  report_id: string;
  incident_id: string;
  relationship: PredictedRelationship;
  severity: PredictedSeverity;
  confidence: number;
  actions: PredictedAction[];
  incident_status: PredictedIncidentStatus;
  human_review: boolean;
}