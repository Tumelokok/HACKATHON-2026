import type { IncidentState } from "@/domain/lifecycle";
import type { AgentToolName, AgentToolRequest } from "./types";

export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  allowedPurpose: string;
  safetyConstraints: readonly string[];
}

export const CONTROLLED_TOOL_DEFINITIONS: readonly AgentToolDefinition[] = [
  {
    name: "get_incident",
    description: "Read structured incident context.",
    allowedPurpose: "Observe application-owned incident state and evidence.",
    safetyConstraints: ["Read only", "No arbitrary queries"],
  },
  {
    name: "update_incident",
    description: "Request a validated lifecycle update.",
    allowedPurpose: "Submit a lifecycle intent to the application validator.",
    safetyConstraints: ["Proposal only", "Cannot mutate persistence directly"],
  },
  {
    name: "assess_risk",
    description: "Read the deterministic severity assessment.",
    allowedPurpose: "Interpret application-owned risk output.",
    safetyConstraints: ["Cannot invent severity levels", "No model-only override"],
  },
  {
    name: "notify_security",
    description: "Request the controlled security notification action.",
    allowedPurpose: "Map to NOTIFY_SECURITY through ActionPolicy.",
    safetyConstraints: ["Simulated only", "Policy validation required"],
  },
  {
    name: "notify_trusted_contact",
    description: "Request the controlled trusted-contact action.",
    allowedPurpose: "Map to NOTIFY_TRUSTED_CONTACT through ActionPolicy.",
    safetyConstraints: ["Simulated only", "Policy validation required"],
  },
  {
    name: "request_location",
    description: "Request missing or uncertain location information.",
    allowedPurpose: "Map to REQUEST_LOCATION through ActionPolicy.",
    safetyConstraints: ["No location fabrication", "Policy validation required"],
  },
  {
    name: "close_incident",
    description: "Request closure after credible resolution evidence.",
    allowedPurpose: "Map to CLOSE_INCIDENT through lifecycle and ActionPolicy.",
    safetyConstraints: ["Cannot force resolution", "Credible evidence required"],
  },
];

const toolNames = new Set(CONTROLLED_TOOL_DEFINITIONS.map((definition) => definition.name));

export interface ToolValidationResult {
  valid: boolean;
  request: AgentToolRequest | null;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isState(value: unknown): value is IncidentState {
  return ["CREATED", "ASSESSING", "ACTIVE", "RESPONDING", "MONITORING", "ESCALATED", "RESOLVED", "CANCELLED"].includes(value as string);
}

export function validateToolRequest(value: unknown): ToolValidationResult {
  if (!isRecord(value) || !isString(value.tool) || !toolNames.has(value.tool as AgentToolName) || !isRecord(value.input)) {
    return { valid: false, request: null, reason: "Tool request must use a documented tool and structured input." };
  }

  const input = value.input;
  if (!isString(input.incidentId)) {
    return { valid: false, request: null, reason: "Tool input requires an incidentId." };
  }

  if (value.tool === "get_incident" || value.tool === "assess_risk") {
    return { valid: true, request: value as unknown as AgentToolRequest, reason: "Tool request is valid." };
  }

  if (value.tool === "update_incident") {
    const intent = input.intent;
    if (!isRecord(intent) || !isState(intent.fromState) || !isState(intent.requestedState) || !isString(intent.reason) || !isString(intent.actor) || !isString(intent.requestedAt)) {
      return { valid: false, request: null, reason: "update_incident requires a typed lifecycle intent." };
    }
    return { valid: true, request: value as unknown as AgentToolRequest, reason: "Tool request is valid." };
  }

  if (!isString(input.reason) || !Array.isArray(input.evidenceReportIds) || !input.evidenceReportIds.every(isString)) {
    return { valid: false, request: null, reason: "Action tool input requires a reason and evidence report IDs." };
  }
  return { valid: true, request: value as unknown as AgentToolRequest, reason: "Tool request is valid." };
}