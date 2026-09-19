# Campus Crisis Agent — Data Model

## 1. Purpose

The data model provides persistent storage for reports, incidents, evidence, severity assessments, lifecycle transitions, conflicts, actions and audit events.

The model is designed around the principle:

> Reports are evidence. Incidents are the persistent operational objects.

---

# 2. Entity Overview

```text
Report
   │
   ├──────────────┐
   │              │
   ▼              ▼
Incident      Duplicate Record
   │
   ├── Severity Assessment
   ├── State Transition
   ├── Conflict
   ├── Action
   └── Audit Event
```

---

# 3. Report

Represents an individual input report.

### Fields

```text
Report
├── id
├── reportId
├── processingOrder
├── timestampRaw
├── timestampParsed
├── locationRaw
├── locationNormalized
├── categoryRaw
├── categoryNormalized
├── reportedSeverityRaw
├── reportedSeverityNormalized
├── description
├── reporterTypeRaw
├── reporterTypeNormalized
├── incidentId
├── isDuplicate
├── duplicateOfReportId
├── createdAt
└── updatedAt
```

### Important rules

`processingOrder` is authoritative for processing order.

`timestampRaw` must be preserved even if malformed.

`timestampParsed` may be null when parsing fails.

The system must never discard a report because its timestamp is malformed.

---

# 4. Incident

Represents a real-world or simulated campus incident.

### Fields

```text
Incident
├── id
├── incidentNumber
├── category
├── location
├── severity
├── severityConfidence
├── state
├── stateReason
├── correlationConfidence
├── requiresHumanReview
├── createdAt
├── updatedAt
├── resolvedAt
└── resolutionReason
```

The incident is the central operational object.

---

# 5. IncidentReport Relationship

Each report should be associated with at most one primary incident.

```text
Incident 1 ──────── * Report
```

This allows:

* one incident with many reports
* duplicate reports to remain stored
* follow-up reports to update the same incident
* contradictory reports to coexist as evidence

---

# 6. Severity Assessment

Represents a historical severity assessment.

### Fields

```text
SeverityAssessment
├── id
├── incidentId
├── level
├── confidence
├── reason
├── evidenceReportIds
├── createdAt
└── source
```

`source` may identify whether the assessment was produced by:

```text
RULE_ENGINE
AGENT
HUMAN
```

The final system must retain the assessment history.

---

# 7. State Transition

Represents an incident lifecycle transition.

### Fields

```text
StateTransition
├── id
├── incidentId
├── fromState
├── toState
├── reason
├── triggeringReportId
├── triggeringActionId
├── actor
└── createdAt
```

This allows the dashboard to construct a complete incident timeline.

---

# 8. Conflict

Represents contradictory evidence.

### Fields

```text
Conflict
├── id
├── incidentId
├── type
├── description
├── status
├── requiresHumanReview
├── resolution
├── resolvedBy
├── resolvedAt
└── createdAt
```

---

# 9. Conflict Report Relationship

A conflict can involve multiple reports.

Conceptually:

```text
Conflict
   │
   ├── Report A
   ├── Report B
   └── possibly additional reports
```

The system must preserve which reports generated the conflict.

---

# 10. Action

Represents an attempted or executed response action.

### Fields

```text
Action
├── id
├── incidentId
├── type
├── service
├── status
├── reason
├── requestedBy
├── approvedBy
├── executedAt
├── result
├── failureReason
└── createdAt
```

Possible statuses:

```text
PROPOSED
APPROVED
REJECTED
EXECUTED
FAILED
SUPPRESSED
```

---

# 11. Action Deduplication

Actions must be checked against previous actions for the same incident.

Relevant uniqueness logic may consider:

```text
incidentId
service
actionType
```

The system must still allow a legitimate repeated action when the application determines that a new dispatch is justified.

Therefore, database constraints alone must not be the entire duplicate-prevention mechanism.

---

# 12. Audit Event

Represents an immutable system event.

### Fields

```text
AuditEvent
├── id
├── incidentId
├── reportId
├── actionId
├── eventType
├── actor
├── details
└── createdAt
```

The audit system records important changes and decisions.

---

# 13. Enumerations

## Severity

```text
LOW
MEDIUM
HIGH
CRITICAL
```

## Incident State

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

## Action Status

```text
PROPOSED
APPROVED
REJECTED
EXECUTED
FAILED
SUPPRESSED
```

## Conflict Status

```text
OPEN
UNDER_REVIEW
RESOLVED
```

---

# 14. Data Integrity Rules

The database must enforce appropriate integrity rules.

Examples:

* report ID must be unique
* incident number must be unique
* report must preserve processing order
* incident severity must use an allowed value
* incident state must use an allowed value
* action status must use an allowed value
* relationships must reference existing records
* audit events should not be silently overwritten

---

# 15. Original Evidence Preservation

The database must preserve original input fields.

For example:

```text
categoryRaw
categoryNormalized
```

rather than storing only:

```text
category
```

This allows technical evaluators to verify that normalization did not destroy original evidence.

---

# 16. Processing Order

Every imported report receives:

```text
processingOrder
```

Example:

```text
processingOrder = 1
processingOrder = 2
processingOrder = 3
processingOrder = 4
```

This value is assigned according to file order.

It must not be derived from timestamp.

---

# 17. Resolution Data

When an incident becomes resolved:

```text
resolvedAt
resolutionReason
```

must be recorded.

The report or event that caused resolution should also be identifiable through the state transition/audit trail.

---

# 18. Human Review Data

The incident must support:

```text
requiresHumanReview
```

and the conflict/action records should identify why review was required.

The dashboard must be able to query outstanding reviews.

---

# 19. Data Model Success Criteria

The data model is considered complete when it can represent:

* multiple reports per incident
* duplicate reports
* conflicting reports
* malformed timestamps
* normalized data
* severity history
* lifecycle history
* conflicts
* actions
* duplicate action suppression
* audit events
* human-review requirements
* resolution evidence
