# Campus Crisis Agent — Incident Correlation Specification

## 1. Purpose

The correlation engine determines whether an incoming report represents:

1. a new incident,
2. a new report about an existing incident, or
3. a duplicate of an already processed report.

The engine is one of the most important components of Campus Crisis Agent because the supplied scenarios contain multiple reports describing the evolution of the same incident.

The system must therefore treat reports as evidence rather than automatically treating every report as a separate incident.

---

# 2. Core Principle

A report is not an incident.

```text
REPORT
   ↓
CORRELATION
   ↓
INCIDENT
```

Multiple reports may belong to one incident.

```text
                 ┌── Report A
                 ├── Report B
Incident INC-001 ├── Report C
                 └── Report D
```

---

# 3. Required Classification

Every incoming report receives exactly one primary classification:

```text
NEW_INCIDENT
EXISTING_INCIDENT
DUPLICATE_REPORT
```

A duplicate report is still stored as evidence.

It is not discarded.

---

# 4. Processing Order

Reports must be processed in input-file order.

Example:

```text
Report 1 → process
Report 2 → process
Report 3 → process
Report 4 → process
```

The system must never reorder reports using their timestamps before processing.

Malformed timestamps must therefore not prevent processing.

---

# 5. Candidate Incident Selection

For an incoming report, the engine first identifies candidate incidents.

Candidate incidents may be selected using:

* normalized location
* category
* incident state
* recent incident activity
* description similarity
* known incident characteristics

Only plausible candidates should proceed to detailed scoring.

---

# 6. Correlation Evidence

Each candidate receives evidence from multiple dimensions.

## 6.1 Location

Location is a major correlation signal.

Examples:

```text
"Library Level 2"
"library level 2"
"Library - Level 2"
```

should normalize to a compatible representation.

Exact or highly similar locations increase correlation confidence.

---

## 6.2 Category

Categories should be normalized before comparison.

Example:

```text
"Network Outage"
"network outage"
"NETWORK"
```

should be represented consistently.

Compatible categories increase correlation confidence.

However, category mismatch must not automatically prevent correlation.

An incident can evolve.

For example, an electrical incident may later receive a report describing smoke.

---

# 7. Description Similarity

Descriptions provide semantic evidence.

The implementation may use:

* normalized token overlap
* keyword matching
* structured indicators
* semantic similarity where appropriate

The system should extract meaningful incident indicators rather than relying solely on raw string equality.

Potential indicators include:

```text
fire
smoke
water
electrical
network
lift
trapped
contractor
maintenance
restored
released
evacuated
```

---

# 8. Reporter Type

Reporter type may provide supporting evidence.

For example:

```text
STUDENT
STAFF
SECURITY
MAINTENANCE
ICT
CONTRACTOR
```

A report from an operational service can provide stronger evidence about certain incident developments.

Reporter type must not be treated as automatic truth.

---

# 9. Candidate Scoring

Each candidate incident receives a correlation score.

Conceptual model:

```text
Correlation Score =
    Location Evidence
  + Category Compatibility
  + Description Similarity
  + Context Evidence
  + Incident Activity
```

The exact weights must be defined in implementation constants rather than scattered throughout application code.

Example initial weighting:

```text
Location             0.35
Category             0.20
Description          0.25
Context              0.10
Incident Activity    0.10
```

Total:

```text
1.00
```

These values are implementation parameters and must be validated against the supplied development dataset.

They must not be secretly tuned against hidden evaluation data.

---

# 10. Correlation Thresholds

Initial decision thresholds:

```text
score >= 0.75
    → EXISTING_INCIDENT

0.50 <= score < 0.75
    → AMBIGUOUS / HUMAN REVIEW

score < 0.50
    → NEW_INCIDENT
```

These thresholds are configuration values.

They should be tested against synthetic cases and the supplied development dataset.

The thresholds may be adjusted during development if testing demonstrates that the initial values produce incorrect correlations.

Any adjustment must be documented.

---

# 11. Hard Evidence Rules

Certain evidence should override simple numerical scoring.

## Exact Duplicate

If a report has already been processed with the same unique report ID:

```text
DUPLICATE_REPORT
```

must be returned.

---

## Strong Existing-Incident Evidence

If a report explicitly refers to an existing incident identifier or an application-generated correlation reference, it should attach to that incident subject to validation.

---

## Explicit Resolution/Follow-Up

A report indicating:

* restoration
* release
* repair
* control
* resolution

may belong to an existing incident even if its category differs from the original report.

---

# 12. Ambiguous Correlation

If the system cannot safely determine whether a report belongs to an existing incident, it must not silently force a correlation.

Instead:

```text
AMBIGUOUS
    ↓
PRESERVE REPORT
    ↓
REQUEST HUMAN REVIEW
```

The implementation may internally represent this as a correlation decision requiring review while still assigning the report to the best candidate only when safe according to policy.

---

# 13. Duplicate Versus Follow-Up

This distinction is critical.

### Duplicate

Example:

```text
Report A:
"Network is down across campus."

Report B:
"Network is down across campus."
```

If the evidence is materially identical and B adds no meaningful information:

```text
DUPLICATE_REPORT
```

### Follow-Up

Example:

```text
Report A:
"Network is down."

Report B:
"ICT confirms the outage and is working on restoration."
```

Report B is:

```text
EXISTING_INCIDENT
```

because it adds new evidence.

---

# 14. Contradictory Follow-Up

A contradictory report is not automatically a duplicate.

Example:

```text
Report A:
"Lift doors are closed."

Report B:
"Lift doors are open."
```

Both reports must be preserved.

The second report becomes new evidence attached to the incident and may generate a conflict.

---

# 15. Correlation Result

The correlation engine should return a structured result.

Example:

```text
{
  decision: "EXISTING_INCIDENT",
  incidentId: "INC-001",
  confidence: 0.91,
  evidence: {
    location: 0.98,
    category: 0.80,
    description: 0.89,
    context: 0.92
  },
  reasons: [
    "Same normalized location",
    "Compatible incident category",
    "Description contains related incident indicators"
  ]
}
```

---

# 16. Explainability

The system must record structured reasons for correlation.

It should not rely on a free-form LLM explanation.

The evaluator should be able to understand:

```text
WHY WAS THIS REPORT ATTACHED TO THIS INCIDENT?
```

without reading model internals.

---

# 17. Incident Candidate Lifecycle

Resolved incidents remain searchable.

A new report after resolution must be evaluated against the resolved incident as well as active incidents.

If credible new evidence indicates the incident has resumed, the application may reopen/escalate it according to lifecycle rules.

The system must not automatically create a completely unrelated incident merely because the previous incident was resolved.

---

# 18. Correlation Audit Event

Every correlation decision should generate an audit event containing:

```text
reportId
decision
incidentId
confidence
evidence
reasons
createdAt
```

---

# 19. Correlation Tests

Required tests:

### Test 1 — New Incident

A report with no compatible existing incident creates a new incident.

### Test 2 — Same Location

A compatible report at the same location correlates with the existing incident.

### Test 3 — Same Category

Compatible category increases correlation confidence.

### Test 4 — Different Category

A category change does not automatically create a new incident.

### Test 5 — Exact Duplicate

Identical report ID is classified as duplicate.

### Test 6 — Follow-Up

A report adding meaningful new information attaches to the existing incident.

### Test 7 — Conflict

Contradictory information attaches to the incident and creates a conflict.

### Test 8 — Malformed Timestamp

A malformed timestamp does not prevent processing.

### Test 9 — Input Order

Reports are processed according to file order rather than timestamp.

### Test 10 — Ambiguous Match

Insufficient evidence triggers the configured human-review path.

---

# 20. Correlation Success Criteria

The correlation engine is complete when:

* every report receives a classification
* reports are processed in file order
* duplicate reports are recognized
* follow-ups remain attached to the correct incident
* contradictory reports are preserved
* malformed timestamps do not break processing
* correlation decisions are explainable
* correlation decisions are auditable
* ambiguous cases can trigger human review
