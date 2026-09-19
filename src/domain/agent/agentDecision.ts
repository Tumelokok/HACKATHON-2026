import { actionTypes, createActionProposal } from "@/domain/actions";
import type { ActionType } from "@/domain/actions";
import type {
  AgentActionProposal,
  AgentDecision,
  AgentDecisionType,
  AgentToolName,
  ValidatedModelOutput,
} from "./types";

const decisionTypes: readonly AgentDecisionType[] = [
  "NO_ACTION",
  "PROPOSE_ACTION",
  "REQUEST_HUMAN_REVIEW",
  "REQUEST_MORE_INFORMATION",
  "ESCALATE",
  "PROPOSE_CLOSURE",
];
const toolNames: readonly AgentToolName[] = [
  "get_incident",
  "update_incident",
  "assess_risk",
  "notify_security",
  "notify_trusted_contact",
  "request_location",
  "close_incident",
];

export function isBoundedConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateModelOutput(value: unknown): ValidatedModelOutput | null {
  if (!isRecord(value) || typeof value.decisionType !== "string" || !decisionTypes.includes(value.decisionType as AgentDecisionType) || !isBoundedConfidence(value.confidence) || typeof value.reason !== "string" || value.reason.trim().length === 0 || !Array.isArray(value.evidenceReportIds) || !value.evidenceReportIds.every((item) => typeof item === "string")) {
    return null;
  }

  if (value.state !== undefined && !["CREATED", "ASSESSING", "ACTIVE", "RESPONDING", "MONITORING", "ESCALATED", "RESOLVED", "CANCELLED"].includes(value.state as string)) {
    return null;
  }
  if (value.severity !== undefined && !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(value.severity as string)) {
    return null;
  }

  const actionType = value.actionType === undefined || value.actionType === null
    ? null
    : typeof value.actionType === "string" && actionTypes.includes(value.actionType as ActionType)
      ? value.actionType as ActionType
      : null;
  if (value.actionType !== undefined && value.actionType !== null && actionType === null) {
    return null;
  }
  const toolName = value.toolName === undefined || value.toolName === null
    ? null
    : typeof value.toolName === "string" && toolNames.includes(value.toolName as AgentToolName)
      ? value.toolName as AgentToolName
      : null;
  if (value.toolName !== undefined && value.toolName !== null && toolName === null) {
    return null;
  }

  return {
    decisionType: value.decisionType as AgentDecisionType,
    confidence: value.confidence,
    reason: value.reason,
    actionType,
    toolName,
    evidenceReportIds: value.evidenceReportIds,
  };
}

export function createAgentActionProposal(
  incidentId: string,
  actionType: ActionType,
  reason: string,
  confidence: number,
  evidenceReportIds: readonly string[],
  createdAt: string,
): AgentActionProposal {
  return {
    ...createActionProposal({
      incidentId,
      actionType,
      reason,
      requestedBy: "AGENT",
      evidenceReportIds,
      createdAt,
    }),
    requestedBy: "AGENT",
    confidence,
  };
}

export function modelOutputToDecision(
  output: ValidatedModelOutput,
  incidentId: string,
  createdAt: string,
): AgentDecision {
  const requiresAction = output.decisionType !== "NO_ACTION";
  const actionType = output.actionType ?? (
    output.decisionType === "REQUEST_HUMAN_REVIEW"
      ? "REQUEST_HUMAN_REVIEW"
      : output.decisionType === "REQUEST_MORE_INFORMATION"
        ? "REQUEST_LOCATION"
        : output.decisionType === "ESCALATE"
          ? "ESCALATE_INCIDENT"
          : output.decisionType === "PROPOSE_CLOSURE"
            ? "CLOSE_INCIDENT"
            : null
  );
  const actionProposal = requiresAction && actionType
    ? createAgentActionProposal(incidentId, actionType, output.reason, output.confidence, output.evidenceReportIds, createdAt)
    : null;
  return {
    decisionType: output.decisionType,
    confidence: output.confidence,
    reason: output.reason,
    evidenceReportIds: output.evidenceReportIds,
    actionProposal,
    toolRequest: null,
    fallbackUsed: false,
    modelOutputAccepted: true,
  };
}