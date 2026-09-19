# Campus Crisis Agent — Incident State Machine

## 1. Purpose

The incident state machine defines all valid incident lifecycle transitions.

The system must reject invalid transitions.

---

# 2. States

```text
CREATED
ASSESSING
ACTIVE
RESPONDING
MONITORING
ESCALATED
RESOLVED
CANCELLED
```

---

# 3. State Definitions

## CREATED

The incident has been created but has not completed assessment.

## ASSESSING

The system is evaluating reports, severity and available evidence.

## ACTIVE

The incident is confirmed as requiring active attention.

## RESPONDING

One or more response actions have been initiated.

## MONITORING

The immediate response has occurred and the system is monitoring follow-up evidence.

## ESCALATED

The incident requires elevated response or human intervention.

## RESOLVED

Credible evidence indicates that the incident has been controlled or resolved.

## CANCELLED

The incident was determined to be invalid, withdrawn or otherwise cancelled.

---

# 4. Valid Transitions

```text
CREATED
  → ASSESSING
  → CANCELLED

ASSESSING
  → ACTIVE
  → RESPONDING
  → ESCALATED
  → CANCELLED

ACTIVE
  → RESPONDING
  → ESCALATED
  → MONITORING
  → RESOLVED

RESPONDING
  → MONITORING
  → ESCALATED
  → RESOLVED

MONITORING
  → ACTIVE
  → RESPONDING
  → ESCALATED
  → RESOLVED

ESCALATED
  → RESPONDING
  → MONITORING
  → RESOLVED

RESOLVED
  → ACTIVE
  → ESCALATED

CANCELLED
  → no automatic transitions
```

---

# 5. Invalid Transitions

Examples:

```text
CREATED → RESOLVED
CREATED → RESPONDING
RESOLVED → RESPONDING
CANCELLED → ACTIVE
CANCELLED → RESOLVED
```

must be rejected unless an explicitly defined application workflow permits the transition.

---

# 6. Transition Requirements

Every transition must contain:

```text
fromState
toState
reason
trigger
actor
timestamp
```

The triggering report or action should be referenced where applicable.

---

# 7. Evidence-Driven Transitions

State changes must be triggered by evidence or an authorized system operation.

Example:

```text
Report received
      ↓
ASSESSING
      ↓
Evidence confirms active issue
      ↓
ACTIVE
      ↓
Service notified
      ↓
RESPONDING
      ↓
Response complete
      ↓
MONITORING
      ↓
Resolution evidence
      ↓
RESOLVED
```

---

# 8. Escalation

Escalation may occur when:

- severity increases significantly
- evidence indicates immediate danger
- conflicts make automated handling unsafe
- the incident cannot be safely handled automatically
- human review is required

Escalation must be auditable.

---

# 9. Reopening

A resolved incident may receive new evidence.

The application should determine whether the new report:

1. belongs to the resolved incident and reopens it, or
2. represents a separate incident.

The decision must use the correlation engine.

---

# 10. Resolution

An incident may move to RESOLVED only when sufficient resolution evidence exists.

Examples:

```text
network restored
person released
repair completed
smoke controlled
incident confirmed resolved
```

A simple absence of new reports is not sufficient evidence of resolution.

---

# 11. Cancellation

Cancellation is distinct from resolution.

Use CANCELLED when the incident should no longer be treated as a valid incident.

Use RESOLVED when the incident occurred but has subsequently been controlled/resolved.

---

# 12. State History

Every state change must create a historical record.

Example:

```text
INC-001

CREATED
  ↓
ASSESSING
  ↓
ACTIVE
  ↓
RESPONDING
  ↓
MONITORING
  ↓
RESOLVED
```

The current state alone is insufficient.

---

# 13. Tests

Required tests:

- every valid transition
- every invalid transition
- escalation
- resolution
- cancellation
- reopening
- repeated reports
- control evidence
- resolution evidence
- post-resolution evidence

---

# 14. Success Criteria

The state machine is complete when:

- all states are explicitly defined
- valid transitions are enforced
- invalid transitions are rejected
- transitions are auditable
- resolution requires evidence
- escalation is supported
- conflicts can influence lifecycle decisions
- historical state is preserved