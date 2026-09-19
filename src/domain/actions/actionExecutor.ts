import type {
  ActionAuditEvent,
  ActionExecutionOptions,
  ActionExecutionResult,
  ActionRecord,
  ActionState,
} from "./types";

const simulatedResults: Readonly<Record<ActionRecord["proposal"]["actionType"], string>> = {
  NOTIFY_SECURITY: "SIMULATED_SECURITY_NOTIFICATION",
  NOTIFY_MAINTENANCE: "SIMULATED_MAINTENANCE_NOTIFICATION",
  NOTIFY_ICT: "SIMULATED_ICT_NOTIFICATION",
  NOTIFY_TRUSTED_CONTACT: "SIMULATED_TRUSTED_CONTACT_NOTIFICATION",
  REQUEST_LOCATION: "SIMULATED_LOCATION_REQUEST",
  REQUEST_HUMAN_REVIEW: "SIMULATED_HUMAN_REVIEW_REQUEST",
  ESCALATE_INCIDENT: "SIMULATED_INCIDENT_ESCALATION",
  CLOSE_INCIDENT: "SIMULATED_INCIDENT_CLOSURE",
};

function executionAudit(
  record: ActionRecord,
  state: ActionState,
  eventType: "ACTION_EXECUTED" | "ACTION_FAILED",
  details: string,
): ActionAuditEvent {
  return {
    auditId: `audit-${record.proposal.actionId}-${state.auditEvents.length + 1}-${eventType}`,
    eventType,
    incidentId: record.proposal.incidentId,
    actionId: record.proposal.actionId,
    reportId: record.proposal.evidenceReportIds[0] ?? null,
    actor: "SIMULATED_EXECUTOR",
    details,
    sequence: state.auditEvents.length + 1,
    createdAt: record.proposal.createdAt,
  };
}

export function executeApprovedAction(
  actionId: string,
  state: ActionState,
  options: ActionExecutionOptions = {},
): { result: ActionExecutionResult; state: ActionState } {
  const record = state.records.find((item) => item.proposal.actionId === actionId);
  if (!record) {
    return {
      result: {
        actionId,
        status: "FAILED",
        executed: false,
        simulated: true,
        result: null,
        failureReason: "Action does not exist in the supplied action state.",
        auditEvent: null,
      },
      state,
    };
  }

  if (record.status !== "APPROVED") {
    return {
      result: {
        actionId,
        status: record.status === "FAILED" ? "FAILED" : "FAILED",
        executed: false,
        simulated: true,
        result: null,
        failureReason: `Action cannot execute from status ${record.status}.`,
        auditEvent: null,
      },
      state,
    };
  }

  if (options.shouldFail) {
    const failureReason = options.failureReason ?? "Simulated executor failure.";
    const auditEvent = executionAudit(record, state, "ACTION_FAILED", failureReason);
    const execution: ActionExecutionResult = {
      actionId,
      status: "FAILED",
      executed: false,
      simulated: true,
      result: null,
      failureReason,
      auditEvent,
    };
    return {
      result: execution,
      state: {
        records: state.records.map((item) => item.proposal.actionId === actionId ? { ...item, status: "FAILED", execution } : item),
        auditEvents: [...state.auditEvents, auditEvent],
      },
    };
  }

  const resultText = simulatedResults[record.proposal.actionType];
  const auditEvent = executionAudit(record, state, "ACTION_EXECUTED", resultText);
  const execution: ActionExecutionResult = {
    actionId,
    status: "EXECUTED",
    executed: true,
    simulated: true,
    result: resultText,
    failureReason: null,
    auditEvent,
  };
  return {
    result: execution,
    state: {
      records: state.records.map((item) => item.proposal.actionId === actionId ? { ...item, status: "EXECUTED", execution } : item),
      auditEvents: [...state.auditEvents, auditEvent],
    },
  };
}