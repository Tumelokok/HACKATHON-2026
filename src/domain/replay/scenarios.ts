import type { ReplayAssertion, ReplayScenario } from "./types";
import { assertion } from "./replayEvaluator";

const base = {
  timestamp: "2026-09-20T10:00:00Z",
  location: "Library Level 2",
  category: "Other",
  reported_severity: "low",
  description: "A minor issue is reported.",
  reporter_type: "student",
};

function allReports(trace: readonly import("./types").ReplayReportResult[]): string[] {
  return trace.map((item) => item.reportId);
}

function networkAssertions(trace: readonly import("./types").ReplayReportResult[]): ReplayAssertion[] {
  const incidentId = trace.find((item) => item.incidentId !== null)?.incidentId;
  return [
    assertion("incident-correlation", "Network follow-ups remain on one incident", trace.filter((item) => item.incidentId === incidentId).length >= 3, allReports(trace)),
    assertion("incident-correlation", "A duplicate report is identified", trace.some((item) => item.duplicate), [trace.find((item) => item.duplicate)?.reportId ?? "none"]),
    assertion("severity", "Severity is available for the correlated incident", trace.some((item) => item.severity !== null), [trace.find((item) => item.severity)?.severity?.level ?? "none"]),
    assertion("actions-services", "The agent can produce a policy-reviewed proposal", trace.some((item) => item.actions.some((action) => action.policy !== null)), allReports(trace)),
  ];
}

function smokeAssertions(trace: readonly import("./types").ReplayReportResult[]): ReplayAssertion[] {
  return [
    assertion("severity", "Smoke/electrical evidence reaches elevated severity", trace.some((item) => item.severity?.level === "HIGH" || item.severity?.level === "CRITICAL"), allReports(trace)),
    assertion("conflict-handling", "Contradictory evidence remains visible", trace.some((item) => item.conflicts.conflictExists && item.conflicts.involvedReportIds.length >= 2), allReports(trace)),
    assertion("safety", "Human review is requested for unresolved safety evidence", trace.some((item) => item.agent.decision.decisionType === "REQUEST_HUMAN_REVIEW"), allReports(trace)),
  ];
}

function contractorAssertions(trace: readonly import("./types").ReplayReportResult[]): ReplayAssertion[] {
  return [
    assertion("conflict-handling", "Contractor uncertainty is preserved as evidence", trace.some((item) => item.conflicts.conflictExists || item.agent.decision.decisionType === "REQUEST_HUMAN_REVIEW"), allReports(trace)),
    assertion("actions-services", "The policy records a human-review or security decision", trace.some((item) => item.actions.some((action) => action.actionType === "REQUEST_HUMAN_REVIEW" || action.actionType === "NOTIFY_SECURITY")), allReports(trace)),
  ];
}

function liftAssertions(trace: readonly import("./types").ReplayReportResult[]): ReplayAssertion[] {
  return [
    assertion("incident-correlation", "Lift reports correlate into one incident", new Set(trace.filter((item) => item.incidentId).map((item) => item.incidentId)).size === 1, allReports(trace)),
    assertion("actions-services", "Maintenance action is policy-reviewed", trace.some((item) => item.actions.some((action) => action.actionType === "NOTIFY_MAINTENANCE")), allReports(trace)),
        assertion("resolution", "Lifecycle can record a resolution or reopening", trace.some((item) => item.lifecycle.some((result) => result.resultingState === "RESOLVED" || result.fromState === "RESOLVED")), allReports(trace)),
  ];
}

export const replayScenarios: readonly ReplayScenario[] = [
  {
    name: "NETWORK_OUTAGE",
    description: "Network outage progression, duplicate, recovery, and policy review.",
    inputs: [
      { report: { ...base, report_id: "NET-001", category: "Network Outage", reported_severity: "medium", description: "Internet access is unavailable in the library." } },
      { report: { ...base, report_id: "NET-002", category: "network-outage", description: "Students and staff cannot connect to campus Wi-Fi." } },
      { report: { ...base, report_id: "NET-003", category: "Network Outage", reported_severity: "high", description: "The outage is affecting multiple classrooms." } },
      { report: { ...base, report_id: "NET-003", category: "Network Outage", description: "Duplicate outage report." } },
      { report: { ...base, report_id: "NET-004", category: "Network Outage", description: "ICT confirms restoration work is underway." } },
      { report: { ...base, report_id: "NET-005", category: "Network Outage", reported_severity: "low", description: "Network restored and tested successfully." } },
    ],
    assertions: [networkAssertions],
  },
  {
    name: "SMOKE_ELECTRICAL",
    description: "Smoke and electrical danger with contradiction and controlled resolution evidence.",
    inputs: [
      { report: { ...base, report_id: "SMK-001", category: "Smoke", reported_severity: "high", description: "Smoke is visible near the electrical panel." } },
      { report: { ...base, report_id: "SMK-002", category: "Smoke", reported_severity: "critical", description: "Smoke near the electrical panel; sparks are continuing and evacuation is advised." } },
      { report: { ...base, report_id: "SMK-003", category: "Smoke", reported_severity: "low", description: "No smoke visible near the electrical panel, but the panel remains under observation." } },
      { report: { ...base, report_id: "SMK-004", category: "Smoke", reported_severity: "high", description: "Immediate danger remains near the electrical panel and smoke area." } },
      { report: { ...base, report_id: "SMK-005", category: "Smoke", reported_severity: "low", description: "Power isolated at the electrical panel, hazard removed, and panel tested." } },
    ],
    assertions: [smokeAssertions],
  },
  {
    name: "CONTRACTOR_VERIFICATION",
    description: "Contractor access uncertainty and conflicting verification evidence.",
    inputs: [
      { report: { ...base, report_id: "CON-001", category: "Security", reported_severity: "medium", description: "A contractor is requesting access near the laboratory." } },
      { report: { ...base, report_id: "CON-002", category: "Security", description: "The contractor says they were authorized by maintenance." } },
      { report: { ...base, report_id: "CON-003", category: "Security", reported_severity: "high", description: "Security cannot verify the contractor identity." } },
      { report: { ...base, report_id: "CON-004", category: "Security", description: "Maintenance confirms the contractor authorization." } },
    ],
    assertions: [contractorAssertions],
  },

    {
    // LFT-003 describes an operational state (maintenance on-site) during
    // an active trapped-passenger incident. It does not assert a lower
    // severity, so it must not inherit base.reported_severity = "low" —
    // doing so creates a spurious SEVERITY_CONTRADICTION that blocks
    // credible resolution in the lifecycle engine.
    name: "LIFT_ACCESSIBILITY",
    description: "Lift failure, accessibility impact, maintenance response, resolution, and renewed evidence.",
    inputs: [
      { report: { ...base, report_id: "LFT-001", category: "Lift", reported_severity: "high", description: "A passenger is trapped in the lift." } },
      { report: { ...base, report_id: "LFT-002", category: "Lift", reported_severity: "high", description: "The lift failure is affecting wheelchair access." } },
            { report: { ...base, report_id: "LFT-003", category: "Lift", reported_severity: "high", description: "Maintenance has arrived and is working on the lift." } },
      { report: { ...base, report_id: "LFT-004", category: "Lift", reported_severity: "low", description: "Passenger released, lift repaired and tested." } },
      { report: { ...base, report_id: "LFT-005", category: "Lift", reported_severity: "high", description: "Person trapped in the lift again." } },
    ],
    assertions: [liftAssertions],
  },
];