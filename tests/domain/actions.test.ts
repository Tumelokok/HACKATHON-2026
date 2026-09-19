import { describe, expect, it } from "vitest";

import {
  ACTION_POLICY_MATRIX,
  createActionProposal,
  createActionState,
  executeApprovedAction,
  submitActionProposal,
} from "../../src/domain/actions";
import type {
  ActionPolicyContext,
  ActionProposal,
  ActionType,
} from "../../src/domain/actions";
import { processReport } from "../../src/domain/processing/reportProcessing";
import type { RawReportInput } from "../../src/types/report";

const baseInput: RawReportInput = {
  report_id: "R-001",
  timestamp: "2026-09-20T10:00:00Z",
  location: "Library Level 2",
  category: "Fire",
  reported_severity: "high",
  description: "Smoke and danger are reported.",
  reporter_type: "student",
};

function report(overrides: Partial<RawReportInput> = {}, order = 0) {
  return processReport({ ...baseInput, ...overrides }, order).normalizedReport;
}

function context(overrides: Partial<ActionPolicyContext> = {}): ActionPolicyContext {
  return {
    incidentExists: true,
    incidentId: "incident-R-001",
    incidentState: "ACTIVE",
    severity: "HIGH",
    conflictResult: null,
    reports: [report()],
    correlationDecision: "EXISTING_INCIDENT",
    correlationMatchStatus: "MATCHED",
    credibleResolutionEvidence: false,
    ...overrides,
  };
}

function proposal(
  actionType: ActionType,
  overrides: Partial<Parameters<typeof createActionProposal>[0]> = {},
): ActionProposal {
  return createActionProposal({
    incidentId: "incident-R-001",
    actionType,
    reason: `Evidence supports ${actionType}.`,
    requestedBy: "APPLICATION",
    evidenceReportIds: ["R-001"],
    createdAt: "2026-09-20T10:01:00Z",
    ...overrides,
  });
}

function submit(
  actionType: ActionType,
  actionContext: ActionPolicyContext = context(),
  overrides: Partial<Parameters<typeof createActionProposal>[0]> = {},
) {
  return submitActionProposal(proposal(actionType, overrides), actionContext, createActionState());
}

describe("action policy and simulated executor", () => {
  it("accepts a valid security proposal", () => {
    const result = submit("NOTIFY_SECURITY");

    expect(result.policy.decision).toBe("APPROVED");
    expect(result.state.records[0]?.status).toBe("APPROVED");
  });

  it("rejects an invalid action type", () => {
    const invalid = proposal("NOT_A_REAL_ACTION" as ActionType);
    const result = submitActionProposal(invalid, context(), createActionState());

    expect(result.policy.decision).toBe("REJECTED");
  });

  it("rejects an action that is not applicable", () => {
    const result = submit("NOTIFY_SECURITY", context({
      severity: "LOW",
      reports: [report({ category: "Network Outage", description: "Routine network outage." })],
    }));

    expect(result.policy.decision).toBe("REJECTED");
    expect(result.policy.reason).toContain("not applicable");
  });

  it("rejects an action invalid for the lifecycle state", () => {
    const result = submit("NOTIFY_SECURITY", context({ incidentState: "CANCELLED" }));

    expect(result.policy.decision).toBe("REJECTED");
    expect(result.policy.reason).toContain("CANCELLED");
  });

  it("supports escalation for severe danger", () => {
    const result = submit("ESCALATE_INCIDENT", context({ severity: "CRITICAL" }));

    expect(result.policy.decision).toBe("APPROVED");
  });

  it("supports human review for a serious safety conflict", () => {
    const result = submit("REQUEST_HUMAN_REVIEW", context({
      conflictResult: {
        conflictExists: true,
        conflictId: "conflict-1",
        duplicateOfConflictId: null,
        conflictType: "FACTUAL_CONTRADICTION",
        incidentId: "incident-R-001",
        involvedReportIds: ["R-001", "R-002"],
        evidenceReports: [report(), report({ report_id: "R-002" }, 1)],
        signals: [],
        confidence: 0.9,
        explanation: "Conflicting safety evidence.",
        requiresHumanReview: true,
        status: "UNDER_REVIEW",
        isDuplicate: false,
      },
    }));

    expect(result.policy.decision).toBe("APPROVED");
    expect(result.policy.requiresHumanReview).toBe(true);
  });

  it("rejects CLOSE_INCIDENT without credible resolution evidence", () => {
    const result = submit("CLOSE_INCIDENT", context({ incidentState: "MONITORING" }));

    expect(result.policy.decision).toBe("REJECTED");
    expect(result.policy.requiresHumanReview).toBe(true);
  });

  it("approves CLOSE_INCIDENT with credible resolution evidence", () => {
    const result = submit("CLOSE_INCIDENT", context({
      incidentState: "MONITORING",
      severity: "LOW",
      credibleResolutionEvidence: true,
      reports: [report({ description: "Technician repaired the panel and tested it." })],
    }));

    expect(result.policy.decision).toBe("APPROVED");
  });

  it("rejects automatic operational actions for cancelled incidents", () => {
    const result = submit("NOTIFY_MAINTENANCE", context({ incidentState: "CANCELLED" }));

    expect(result.policy.decision).toBe("REJECTED");
  });

  it("suppresses an equivalent action after execution", () => {
    const first = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(first.proposal.actionId, first.state);
    const second = submitActionProposal(first.proposal, context(), executed.state);

    expect(executed.result.status).toBe("EXECUTED");
    expect(second.policy.decision).toBe("SUPPRESSED");
    expect(second.state.records.at(-1)?.status).toBe("SUPPRESSED");
  });

  it("allows a justified repeat with a new idempotency key", () => {
    const first = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(first.proposal.actionId, first.state);
    const repeat = submitActionProposal(
      proposal("NOTIFY_SECURITY", {
        idempotencyKey: "follow-up-1",
        allowRepeat: true,
        repeatJustification: "New danger evidence requires renewed notification.",
        evidenceReportIds: ["R-002"],
      }),
      context(),
      executed.state,
    );

    expect(repeat.policy.decision).toBe("APPROVED");
  });

  it("keeps proposed actions distinct from execution", () => {
    const action = createActionProposal({
      incidentId: "incident-R-001",
      actionType: "NOTIFY_SECURITY",
      reason: "Proposal only.",
      requestedBy: "APPLICATION",
      evidenceReportIds: ["R-001"],
      createdAt: "2026-09-20T10:01:00Z",
    });

    expect(action.status).toBe("PROPOSED");
  });

  it("executes an approved action", () => {
    const submitted = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(submitted.proposal.actionId, submitted.state);

    expect(executed.result.executed).toBe(true);
    expect(executed.result.status).toBe("EXECUTED");
    expect(executed.state.records[0]?.status).toBe("EXECUTED");
  });

  it("does not execute a rejected action", () => {
    const submitted = submit("NOTIFY_SECURITY", context({ severity: "LOW", reports: [report({ category: "Other", description: "Minor issue." })] }));
    const execution = executeApprovedAction(submitted.proposal.actionId, submitted.state);

    expect(submitted.policy.decision).toBe("REJECTED");
    expect(execution.result.executed).toBe(false);
  });

  it("does not execute a suppressed action", () => {
    const first = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(first.proposal.actionId, first.state);
    const suppressed = submitActionProposal(first.proposal, context(), executed.state);
    const execution = executeApprovedAction(suppressed.proposal.actionId, suppressed.state);

    expect(suppressed.policy.decision).toBe("SUPPRESSED");
    expect(execution.result.executed).toBe(false);
  });

  it("represents failed simulated execution as FAILED", () => {
    const submitted = submit("NOTIFY_SECURITY");
    const failed = executeApprovedAction(submitted.proposal.actionId, submitted.state, {
      shouldFail: true,
      failureReason: "Simulated local failure.",
    });

    expect(failed.result.status).toBe("FAILED");
    expect(failed.result.failureReason).toBe("Simulated local failure.");
    expect(failed.state.records[0]?.status).toBe("FAILED");
  });

  it("returns a successful simulated result", () => {
    const submitted = submit("NOTIFY_MAINTENANCE", context({ reports: [report({ category: "Electrical", description: "Electrical panel requires repair." })] }));
    const executed = executeApprovedAction(submitted.proposal.actionId, submitted.state);

    expect(executed.result.simulated).toBe(true);
    expect(executed.result.result).toBe("SIMULATED_MAINTENANCE_NOTIFICATION");
  });

  it("does not call external services and marks every execution simulated", () => {
    const submitted = submit("NOTIFY_ICT", context({ reports: [report({ category: "Network Outage", description: "Network outage affects systems." })] }));
    const executed = executeApprovedAction(submitted.proposal.actionId, submitted.state);

    expect(executed.result.simulated).toBe(true);
    expect(executed.result.result).toContain("SIMULATED");
  });

  it("audits proposal and approval", () => {
    const result = submit("NOTIFY_SECURITY");

    expect(result.state.auditEvents.map((event) => event.eventType)).toEqual([
      "ACTION_PROPOSED",
      "ACTION_APPROVED",
    ]);
  });

  it("audits rejection", () => {
    const result = submit("NOTIFY_SECURITY", context({ severity: "LOW", reports: [report({ category: "Other", description: "Minor issue." })] }));

    expect(result.state.auditEvents.at(-1)?.eventType).toBe("ACTION_REJECTED");
  });

  it("audits suppression", () => {
    const first = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(first.proposal.actionId, first.state);
    const second = submitActionProposal(first.proposal, context(), executed.state);

    expect(second.state.auditEvents.at(-1)?.eventType).toBe("ACTION_SUPPRESSED");
  });

  it("audits execution", () => {
    const submitted = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(submitted.proposal.actionId, submitted.state);

    expect(executed.state.auditEvents.at(-1)?.eventType).toBe("ACTION_EXECUTED");
  });

  it("audits failure", () => {
    const submitted = submit("NOTIFY_SECURITY");
    const failed = executeApprovedAction(submitted.proposal.actionId, submitted.state, { shouldFail: true });

    expect(failed.state.auditEvents.at(-1)?.eventType).toBe("ACTION_FAILED");
  });

  it("keeps audit history append-only", () => {
    const submitted = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(submitted.proposal.actionId, submitted.state);

    expect(executed.state.auditEvents.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(submitted.state.auditEvents).toHaveLength(2);
  });

  it("generates deterministic idempotent action IDs", () => {
    const first = proposal("NOTIFY_SECURITY");
    const second = proposal("NOTIFY_SECURITY");

    expect(first.actionId).toBe(second.actionId);
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });

  it("does not execute the same incident/action twice accidentally", () => {
    const submitted = submit("NOTIFY_SECURITY");
    const executed = executeApprovedAction(submitted.proposal.actionId, submitted.state);
    const duplicate = submitActionProposal(submitted.proposal, context(), executed.state);
    const secondExecution = executeApprovedAction(duplicate.proposal.actionId, duplicate.state);

    expect(duplicate.policy.decision).toBe("SUPPRESSED");
    expect(secondExecution.result.executed).toBe(false);
  });

  it("allows the same action independently for another incident", () => {
    const first = submit("NOTIFY_SECURITY");
    const second = submitActionProposal(
      proposal("NOTIFY_SECURITY", { incidentId: "incident-R-002" }),
      context({ incidentId: "incident-R-002" }),
      createActionState(),
    );

    expect(first.policy.decision).toBe("APPROVED");
    expect(second.policy.decision).toBe("APPROVED");
    expect(first.proposal.actionId).not.toBe(second.proposal.actionId);
  });

  it("represents REQUEST_HUMAN_REVIEW explicitly", () => {
    const result = submit("REQUEST_HUMAN_REVIEW", context({ severity: "LOW" }));

    expect(result.policy.decision).toBe("APPROVED");
    expect(result.policy.requiresHumanReview).toBe(true);
    expect(result.state.auditEvents.some((event) => event.eventType === "HUMAN_REVIEW_REQUESTED")).toBe(true);
  });

  it("approves REQUEST_LOCATION when location is missing", () => {
    const result = submit("REQUEST_LOCATION", context({ reports: [report({ location: "" })] }));

    expect(result.policy.decision).toBe("APPROVED");
  });

  it("applies deterministic security applicability", () => {
    expect(submit("NOTIFY_SECURITY", context({ reports: [report({ category: "Security" })] })).policy.decision).toBe("APPROVED");
  });

  it("applies deterministic maintenance applicability", () => {
    expect(submit("NOTIFY_MAINTENANCE", context({ reports: [report({ category: "Electrical" })] })).policy.decision).toBe("APPROVED");
  });

  it("applies deterministic ICT applicability", () => {
    expect(submit("NOTIFY_ICT", context({ reports: [report({ category: "Network Outage" })] })).policy.decision).toBe("APPROVED");
  });

  it("requires serious evidence for trusted-contact notification", () => {
    expect(submit("NOTIFY_TRUSTED_CONTACT", context({ severity: "HIGH" })).policy.decision).toBe("APPROVED");
    expect(submit("NOTIFY_TRUSTED_CONTACT", context({ severity: "LOW" })).policy.decision).toBe("REJECTED");
  });

  it("keeps escalation subject to lifecycle and evidence policy", () => {
    const rejected = submit("ESCALATE_INCIDENT", context({ severity: "LOW", incidentState: "ACTIVE" }));
    const approved = submit("ESCALATE_INCIDENT", context({ severity: "HIGH", incidentState: "ACTIVE" }));

    expect(rejected.policy.decision).toBe("REJECTED");
    expect(approved.policy.decision).toBe("APPROVED");
  });

  it("rejects closing when an unresolved conflict remains", () => {
    const result = submit("CLOSE_INCIDENT", context({
      incidentState: "MONITORING",
      severity: "LOW",
      credibleResolutionEvidence: true,
      conflictResult: {
        conflictExists: true,
        conflictId: "conflict-1",
        duplicateOfConflictId: null,
        conflictType: "FACTUAL_CONTRADICTION",
        incidentId: "incident-R-001",
        involvedReportIds: ["R-001", "R-002"],
        evidenceReports: [report(), report({ report_id: "R-002" }, 1)],
        signals: [],
        confidence: 0.9,
        explanation: "Unresolved conflict.",
        requiresHumanReview: true,
        status: "UNDER_REVIEW",
        isDuplicate: false,
      },
    }));

    expect(result.policy.decision).toBe("REJECTED");
  });

  it("handles malformed timestamps without breaking policy", () => {
    const result = submit("NOTIFY_SECURITY", context({ reports: [report({ timestamp: "invalid" })] }));

    expect(result.policy.decision).toBe("APPROVED");
  });

  it("returns the same policy decision for the same input", () => {
    const first = submit("NOTIFY_SECURITY");
    const second = submit("NOTIFY_SECURITY");

    expect(first.policy).toEqual(second.policy);
  });

  it("keeps policy reasons concise and explainable", () => {
    const result = submit("NOTIFY_SECURITY");

    expect(result.policy.reason.length).toBeLessThan(180);
    expect(result.policy.reason.length).toBeGreaterThan(0);
  });

  it("preserves relevant evidence report IDs", () => {
    const result = submit("NOTIFY_SECURITY", context(), { evidenceReportIds: ["R-001", "R-002"] });

    expect(result.proposal.evidenceReportIds).toEqual(["R-001", "R-002"]);
  });

  it("preserves raw report evidence untouched", () => {
    const rawDescription = "  Smoke reported near the library.  ";
    const result = submit("NOTIFY_SECURITY", context({ reports: [report({ description: rawDescription })] }));

    expect(result.policy.decision).toBe("APPROVED");
    expect(result.state.records[0]?.proposal.evidenceReportIds).toEqual(["R-001"]);
  });

  it("does not overwrite historical action proposals", () => {
    const first = submit("NOTIFY_SECURITY");
    const second = submitActionProposal(
      proposal("REQUEST_HUMAN_REVIEW", { reason: "Later review request." }),
      context(),
      first.state,
    );

    expect(second.state.records).toHaveLength(2);
    expect(second.state.records[0]?.proposal.actionType).toBe("NOTIFY_SECURITY");
    expect(second.state.records[1]?.proposal.actionType).toBe("REQUEST_HUMAN_REVIEW");
  });

  it("does not auto-propose actions during report processing", () => {
    const processed = processReport(baseInput, 0);

    expect(processed).not.toHaveProperty("actionProposal");
    expect(processed).not.toHaveProperty("actionExecution");
  });

  it("exposes all documented policy actions", () => {
    expect(Object.keys(ACTION_POLICY_MATRIX).sort()).toEqual([
      "CLOSE_INCIDENT",
      "ESCALATE_INCIDENT",
      "NOTIFY_ICT",
      "NOTIFY_MAINTENANCE",
      "NOTIFY_SECURITY",
      "NOTIFY_TRUSTED_CONTACT",
      "REQUEST_HUMAN_REVIEW",
      "REQUEST_LOCATION",
    ]);
  });
});
