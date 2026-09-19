# Campus Crisis Agent — Action and Policy Specification

## 1. Purpose

The action policy defines which actions the Campus Crisis Agent may request and under what conditions those actions can execute.

The agent may recommend an action.

The application decides whether the action is permitted.

---

# 2. Action Pipeline

```text
Agent Decision
      ↓
Schema Validation
      ↓
Action Applicability
      ↓
Incident State Validation
      ↓
Duplicate Check
      ↓
Safety Policy
      ↓
Human Review Requirement
      ↓
APPROVE / REJECT
      ↓
Action Executor
      ↓
Audit
```

---

# 3. Action Types

Initial controlled actions:

```text
NOTIFY_SECURITY
NOTIFY_MAINTENANCE
NOTIFY_ICT
NOTIFY_TRUSTED_CONTACT
REQUEST_HUMAN_REVIEW
REQUEST_LOCATION
ESCALATE_INCIDENT
CLOSE_INCIDENT
```

Additional actions may be added when required by the evaluation scenarios.

---

# 4. Action Applicability

Actions must correspond to the incident.

Examples:

```text
Network outage
    → NOTIFY_ICT

Physical/security threat
    → NOTIFY_SECURITY

Equipment/building issue
    → NOTIFY_MAINTENANCE

Ambiguous high-risk situation
    → REQUEST_HUMAN_REVIEW

Insufficient location
    → REQUEST_LOCATION
```

These mappings are policy rules, not arbitrary model decisions.

---

# 5. Action Authorization

An action can execute only if:

```text
Incident exists
AND
Incident is not CANCELLED
AND
Action type is permitted
AND
Action applies to the incident
AND
Action arguments are valid
AND
Action is not an inappropriate duplicate
AND
Safety policy permits execution
```

---

# 6. Duplicate Action Prevention

Before executing an action, the system checks previous actions for the same incident.

Example:

```text
INC-001
   ↓
NOTIFY_SECURITY
   ↓
EXECUTED
   ↓
new report
   ↓
agent proposes NOTIFY_SECURITY
   ↓
duplicate check
   ↓
SUPPRESSED
```

A new action may still be permitted when materially new evidence justifies another notification.

The system must record why the repeated action was allowed or suppressed.

---

# 7. Human Review

Human review must be requested when:

- correlation is ambiguous
- evidence is materially contradictory
- confidence is insufficient
- automated action would create unacceptable uncertainty
- policy explicitly requires human authorization

Human review is itself an auditable action.

---

# 8. Action Status

Actions use:

```text
PROPOSED
APPROVED
REJECTED
EXECUTED
FAILED
SUPPRESSED
```

---

# 9. Simulated Services

Unless a verified real integration exists, service notifications are simulated.

The system must clearly label them as simulated.

Example:

```text
SECURITY NOTIFICATION
Status: SIMULATED — EXECUTED
```

The system must never claim that a real external emergency service was contacted when it was not.

---

# 10. Failure Handling

If execution fails:

```text
Action
  ↓
FAILED
  ↓
Audit Event
  ↓
Incident remains observable
```

The system must not convert a failed action into a successful action.

---

# 11. Agent Cannot Bypass Policy

The following are prohibited:

```text
Agent → Database
Agent → unrestricted API
Agent → arbitrary service
Agent → arbitrary state
Agent → direct external emergency system
```

The correct flow is:

```text
Agent
  ↓
Controlled Tool
  ↓
Policy Guard
  ↓
Executor
```

---

# 12. State-Aware Actions

Actions must respect incident lifecycle.

For example:

```text
RESOLVED
    ↓
normal response action
    ↓
not automatically allowed
```

A new report may cause reassessment before a new action is authorized.

---

# 13. Resolution Action

`CLOSE_INCIDENT` must require credible resolution evidence.

The agent cannot close an incident merely because:

- no new report has arrived
- confidence is low
- the incident has existed for a long time

---

# 14. Audit Requirements

Every action must record:

```text
actionId
incidentId
actionType
service
requestedBy
policyDecision
reason
status
result
createdAt
```

---

# 15. Policy Tests

Required tests:

- valid action
- invalid action
- malformed action arguments
- wrong service
- cancelled incident
- resolved incident
- duplicate notification
- justified repeated notification
- human-review requirement
- action failure
- simulated-service labelling
- invalid close request
- escalation

---

# 16. Success Criteria

The action policy is complete when:

- all actions are controlled
- invalid actions are rejected
- duplicate actions are prevented
- justified repeated actions are possible
- human review is supported
- action failures are observable
- simulated services are clearly identified
- every action is audited
- the agent cannot bypass application policy