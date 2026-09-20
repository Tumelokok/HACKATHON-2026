# Campus Crisis Agent — System Architecture

## 1. Architecture Overview

Campus Crisis Agent is an event-driven incident-processing system.

The system receives reports, validates and normalizes them, correlates them with incidents, evaluates severity and conflicts, updates incident state, allows a bounded agent to select permitted actions, validates those actions through a policy layer, executes them, and records the resulting audit trail.

The architecture separates:

* raw evidence
* incident state
* deterministic decision logic
* agent reasoning
* action authorization
* action execution
* audit history
* human observation

The application owns the system state.

The AI agent operates inside controlled application boundaries.

## Application Orchestration Layer

The application orchestration layer coordinates the deterministic engines after report processing and before any simulated action execution:

```text
Processed Report
    ↓
Orchestration Context
    ↓
Lifecycle Intent → Lifecycle Engine
    ↓
Agent Observation / Deterministic Fallback
    ↓
Action Proposal → Action Policy → Simulated Executor
    ↓
Audit and Immutable State
```

The orchestrator does not replace domain authority. Correlation, severity, conflict detection, lifecycle validation, action policy, and execution remain owned by their respective engines. It may recommend a lifecycle intent or action, but it must pass those requests through the authoritative validator before state or action changes occur.

Reports remain untrusted evidence, timestamps never determine processing order, and ambiguous or duplicate correlation results cannot mutate a confirmed incident or dispatch an action.

---

# 2. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │   Student / Reporter │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Report Intake     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Validation / Parsing │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Normalization     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Duplicate Detection  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Correlation Engine  │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │                      │
                    ▼                      ▼
             Existing Incident       New Incident
                    │                      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Evidence Store    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       ┌────────────┐   ┌────────────┐   ┌────────────┐
       │  Severity  │   │  Conflict  │   │  Lifecycle │
       │   Engine   │   │   Engine   │   │   Engine   │
       └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
             │                │                │
             └────────────────┼────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │    Incident State    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Agent Engine     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Policy Guard     │
                    └──────────┬───────────┘
                               │
                     ┌─────────┴─────────┐
                     │                   │
                     ▼                   ▼
               Action Allowed       Action Rejected
                     │                   │
                     ▼                   ▼
              Action Executor       Audit Event
                     │
                     ▼
                Audit Event
                     │
                     ▼
             Updated Incident
```

---

# 3. Architecture Layers

## 3.1 Presentation Layer

The presentation layer contains two primary interfaces.

### Reporter Interface

Used to submit an incident report.

Responsibilities:

* collect report information
* validate required fields
* submit reports
* display submission status
* avoid exposing internal agent reasoning

### Operations Dashboard

Used by human operators and evaluators.

Responsibilities:

* display incidents
* display severity
* display lifecycle state
* display reports/evidence
* display conflicts
* display actions
* display audit history
* display agent decisions
* display human-review requirements
* display scenario replay information

---

# 4. Application/API Layer

The application/API layer provides controlled access to the system.

Potential API areas:

```text
/api/reports
/api/incidents
/api/incidents/:id
/api/incidents/:id/reports
/api/incidents/:id/actions
/api/incidents/:id/conflicts
/api/incidents/:id/timeline
/api/replay
```

The API is responsible for:

* input validation
* authentication/authorization where applicable
* invoking application services
* returning structured responses
* preventing direct database manipulation from the frontend

---

# 5. Report Processing Pipeline

Every report must pass through the same controlled pipeline.

```text
Raw Report
    ↓
Parse
    ↓
Validate
    ↓
Normalize
    ↓
Duplicate Check
    ↓
Correlate
    ↓
Persist Evidence
    ↓
Recalculate Severity
    ↓
Detect Conflicts
    ↓
Evaluate Lifecycle
    ↓
Agent Decision
    ↓
Policy Validation
    ↓
Execute Action
    ↓
Audit
```

The pipeline must process records sequentially.

---

# 6. Processing Order

The order of records in the input file is authoritative for processing.

The system must NOT do this:

```text
Read all reports
      ↓
Sort by timestamp
      ↓
Process
```

Instead:

```text
Read report 1
Process report 1

Read report 2
Process report 2

Read report 3
Process report 3
```

This is necessary because timestamps may be:

* malformed
* inconsistent
* missing
* out of sequence

A timestamp is therefore evidence rather than the source of processing order.

---

# 7. Report Normalization

Raw reports should be preserved exactly as received.

A normalized representation should also be generated.

Example:

```text
Raw:

category = "Network Outage"
reported_severity = "HIGH"

Normalized:

category = NETWORK
reported_severity = HIGH
```

Normalization may include:

* category casing
* whitespace
* severity casing
* location normalization
* safe text normalization
* reporter type normalization

Normalization must never destroy the original report.

---

# 8. Incident Correlation

The correlation engine determines whether a report belongs to an existing incident.

Conceptually:

```text
New Report
    ↓
Candidate Incidents
    ↓
Evidence Comparison
    ↓
Correlation Decision
```

Potential evidence includes:

* location similarity
* category compatibility
* description similarity
* report context
* existing incident state
* report sequence
* known incident characteristics

The engine should produce a structured result.

Example:

```text
CorrelationResult {
    decision: EXISTING_INCIDENT
    incidentId: INC-001
    confidence: 0.91
    reasons: [...]
}
```

The exact algorithm will be implemented and tested separately.

---

# 9. Evidence Model

Reports are immutable evidence records.

An incident may have many reports.

```text
Incident
   ├── Report 001
   ├── Report 002
   ├── Report 003
   └── Report 004
```

A report must not be deleted merely because another report contradicts it.

Instead:

```text
Report A → evidence
Report B → contradictory evidence
```

The conflict engine determines how the contradiction affects the incident.

---

# 10. Severity Engine

Severity is calculated from defined system rules and evidence.

The system supports:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

The severity engine receives:

```text
Incident
+
Reports
+
Relevant evidence
+
Current state
```

and produces:

```text
Severity Assessment
```

containing at minimum:

```text
level
confidence
reason
evidence references
```

Every change to severity must be recorded.

---

# 11. Conflict Engine

The conflict engine identifies contradictions between reports or between evidence and the current incident state.

Examples:

```text
Report A:
doors CLOSED

Report B:
doors OPEN
```

or:

```text
Report A:
incident severity = HIGH

Report B:
incident severity = LOW
```

The system preserves both reports.

The conflict engine determines:

* conflict type
* affected evidence
* whether the conflict is unresolved
* whether human review is required
* whether automated actions should be restricted

---

# 12. Lifecycle Engine

Incident state is controlled by an explicit state machine.

Primary states:

```text
CREATED
ASSESSING
ACTIVE
RESPONDING
MONITORING
RESOLVED
```

Additional states:

```text
ESCALATED
CANCELLED
```

A state transition requires:

```text
Current State
+
Trigger
+
Validation
=
New State
```

Invalid transitions must be rejected.

---

# 13. Agent Architecture

The agent does not directly control the database.

The agent operates through defined tools.

```text
Incident State
      ↓
Agent
      ↓
Tool Selection
      ↓
Tool Validation
      ↓
Policy Guard
      ↓
Execution
```

The agent can reason about:

* incident information
* available evidence
* severity
* conflicts
* lifecycle state
* available services
* previous actions

The agent cannot:

* directly execute arbitrary code
* directly modify database records
* invent tools
* bypass policy
* bypass duplicate prevention
* fabricate external service success

---

# 14. Policy Guard

Every agent action passes through the policy guard.

```text
Agent Action
     ↓
Schema Validation
     ↓
Permission Check
     ↓
Incident-State Check
     ↓
Duplicate Check
     ↓
Safety Rules
     ↓
Allowed / Rejected
```

The policy guard is deterministic application logic.

The language model is not trusted to enforce its own safety boundaries.

---

# 15. Action Executor

The action executor performs approved actions.

During the hackathon, external emergency services should be simulated unless a verified integration exists.

Example:

```text
NOTIFY_SECURITY
    ↓
Simulated Security Service
    ↓
SUCCESS
    ↓
Audit Event
```

The system must clearly distinguish simulation from real-world communication.

---

# 16. Audit System

Every significant system event must be auditable.

Examples:

```text
REPORT_RECEIVED
REPORT_NORMALIZED
REPORT_CORRELATED
DUPLICATE_DETECTED
INCIDENT_CREATED
SEVERITY_CHANGED
CONFLICT_DETECTED
STATE_CHANGED
AGENT_DECISION
ACTION_REQUESTED
ACTION_APPROVED
ACTION_REJECTED
ACTION_EXECUTED
HUMAN_REVIEW_REQUESTED
INCIDENT_RESOLVED
```

Audit events should contain:

```text
event_id
incident_id
event_type
actor
timestamp
details
related_report_id
related_action_id
```

Audit history must be append-oriented.

---

# 17. Human Review

Human review is a controlled system state/action rather than an uncontrolled fallback.

Human review should be requested when:

* evidence conflicts materially
* confidence is insufficient
* safety rules prevent automatic action
* verification cannot be established
* an action requires human authority

The dashboard must expose outstanding human-review requirements.

---

# 18. Duplicate Prevention

Duplicate detection operates at two levels.

## Report Level

Determines whether a report is an exact or near duplicate.

## Action Level

Determines whether an action has already been performed for the same incident and service.

Example:

```text
Incident INC-001
    ↓
Security notified
    ↓
New report received
    ↓
Agent considers notifying security
    ↓
Duplicate action check
    ↓
Already notified
    ↓
Suppress duplicate
```

A legitimate follow-up report must still be preserved even when it does not trigger a new action.

---

# 19. Resolution

An incident should move toward resolution when credible evidence indicates that the underlying issue has been controlled or resolved.

Examples:

```text
Network restored
Person released
Repair completed
Smoke controlled
Incident controlled
```

Resolution evidence must be preserved.

A resolved incident must not silently disappear.

---

# 20. Database Boundary

Only backend application services may access the database directly.

The frontend communicates through APIs.

The agent communicates through application tools.

The architecture therefore becomes:

```text
Frontend
   ↓
API
   ↓
Application Services
   ↓
Domain Logic
   ↓
Repositories
   ↓
Database
```

No frontend component should directly manipulate database state.

---

# 21. Proposed Technology Stack

## Frontend

* Next.js
* TypeScript
* Tailwind CSS

## Backend

* Next.js server-side/API capabilities
* TypeScript

## Database

* PostgreSQL

## ORM

* Prisma

## Agent

A provider-independent agent abstraction.

The application should not tightly couple the core incident-processing system to one specific model provider.

The model provider can therefore be changed without rewriting the incident engine.

## Testing

* unit testing
* integration testing
* scenario replay testing
* API testing

---

# 22. Core Architectural Principle

The system follows:

> Deterministic application logic controls safety and state; AI assists with interpretation and action selection.

This creates a bounded agent architecture rather than a conventional unrestricted chatbot.

---

# 23. Failure Handling

Failures must be observable.

Examples:

```text
Invalid report
    ↓
Validation Error
```

```text
Database failure
    ↓
Processing Failure
    ↓
Audit / Error Log
```

```text
Agent unavailable
    ↓
Controlled fallback
    ↓
Incident remains observable
```

```text
Action rejected
    ↓
No execution
    ↓
Audit event
```

The system must not falsely report successful execution when an action fails.

---

# 24. Security Boundaries

Secrets must remain outside source control.

The system must:

* use environment variables for secrets
* validate external input
* restrict agent tools
* validate action arguments
* avoid exposing sensitive internal data unnecessarily
* prevent unauthorized state mutation
* maintain audit records

---

# 25. Architecture Success Criteria

The architecture is considered implemented when:

* reports can enter the system
* reports are processed sequentially
* reports are normalized
* incidents can be created
* reports can be correlated
* evidence is preserved
* severity can be reassessed
* conflicts can be detected
* lifecycle transitions are controlled
* agent tools are bounded
* actions pass policy validation
* duplicate actions are prevented
* actions are audited
* incidents can be resolved
* dashboard data can observe the entire workflow
