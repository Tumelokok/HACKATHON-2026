# Campus Crisis Agent — Rubric Engineering Contract

## 1. Purpose

This document converts the official Campus Crisis Agent hackathon evaluation criteria into an engineering implementation and testing contract.

The project will not be considered complete merely because the application runs.

Every evaluation criterion must have:

1. A clearly defined requirement.
2. A deliberate implementation.
3. Automated or repeatable tests where applicable.
4. Observable evidence in the dashboard where applicable.
5. A defensible explanation for the technical defence.

The target is full coverage of all 100 evaluation points.

---

# 2. Evaluation Structure

| Evaluation Area            |  Points |
| -------------------------- | ------: |
| Automated Evaluation       |      60 |
| Human Dashboard Evaluation |      25 |
| Technical Defence          |      15 |
| **TOTAL**                  | **100** |

---

# 3. Automated Evaluation — 60 Points

## 3.1 Incident Correlation — 15 Points

### Requirement

The system must determine whether an incoming report:

* creates a new incident, or
* represents additional information about an existing incident.

A report must not automatically become a new incident.

### Required capabilities

The system must consider available evidence such as:

* location
* category
* description
* report timing
* existing incident information
* related reports
* normalized categories
* incident status
* other relevant contextual information

### Important processing rule

Reports must be processed in the exact order in which they appear in the supplied dataset.

The system must not sort reports by timestamp before processing them.

The timestamp is evidence about the report and incident, but it does not determine processing order.

### Required outputs

For every processed report, the system should be able to determine:

```text
NEW INCIDENT
```

or:

```text
EXISTING INCIDENT
```

If correlated, the report must be attached to the existing incident.

### Edge cases

The implementation must handle:

* duplicate reports
* repeated descriptions
* inconsistent casing
* inconsistent categories
* malformed timestamps
* follow-up reports
* reports that materially change incident state
* reports containing contradictory information
* multiple reports referring to the same physical incident

### Implementation

Planned components:

```text
Report Normalizer
Correlation Engine
Incident Repository
Evidence Store
```

### Tests

Tests must cover:

* clearly unrelated reports
* clearly related reports
* exact duplicates
* near duplicates
* same location with different categories
* same category at different locations
* follow-up reports
* malformed timestamps
* inconsistent casing
* multiple reports belonging to one incident

### Dashboard evidence

The dashboard should show:

* incident ID
* number of reports
* originating report
* related reports
* correlation decision
* correlation confidence/reason
* chronological/evidence view where appropriate

---

# 3.2 Actions and Services — 12 Points

## Requirement

The agent must select and execute appropriate permitted actions/services based on the current incident state and evidence.

The system must not allow unrestricted model output to directly perform arbitrary actions.

### Potential actions

The implementation may include controlled actions such as:

```text
NOTIFY_SECURITY
NOTIFY_MAINTENANCE
NOTIFY_ICT
REQUEST_HUMAN_REVIEW
REQUEST_LOCATION
NOTIFY_TRUSTED_CONTACT
ESCALATE_INCIDENT
CLOSE_INCIDENT
```

The final action set must be aligned with the supplied evaluation scenarios.

### Action architecture

The flow must be:

```text
Incident State
      ↓
Agent Decision
      ↓
Policy Validation
      ↓
Duplicate Action Check
      ↓
Action Executor
      ↓
Action Result
      ↓
Audit Log
```

The language model must not bypass the policy layer.

### Required capabilities

The system must:

* select appropriate services
* avoid unauthorized actions
* record action attempts
* record successful actions
* record failed actions
* prevent inappropriate repeat dispatches
* allow escalation
* request human review when necessary

### Scenario coverage

Actions/services must support the supplied scenarios including:

* network outage
* smoke/electrical incident
* contractor verification
* lift/accessibility incident

### Tests

Tests must verify:

* correct service selection
* invalid action rejection
* duplicate action prevention
* escalation behaviour
* human-review requests
* service-specific routing
* action history

### Dashboard evidence

The dashboard should display:

* selected service
* action taken
* action status
* reason
* timestamp
* duplicate suppression where applicable
* escalation/human-review status

---

# 3.3 Severity — 8 Points

## Requirement

The system must determine incident severity using defined criteria.

Severity must not depend solely on unrestricted language-model output.

### Supported levels

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### Severity inputs

The severity engine may consider:

* reported severity
* category
* description
* safety implications
* number of affected people
* escalation indicators
* conflicting evidence
* incident progression
* resolution/control information

### Required behaviour

Severity must be:

* deterministic where rules are sufficient
* explainable
* updateable as new evidence arrives
* recorded in incident history

### Confidence

The system should maintain a confidence value or equivalent evidence strength.

A severity update must preserve the previous assessment in the incident history.

### Tests

Tests must cover:

* low-risk incident
* medium-risk incident
* high-risk incident
* critical incident
* severity escalation
* severity reduction after credible resolution/control evidence
* conflicting severity reports
* malformed/missing severity

### Dashboard evidence

Display:

```text
Current Severity
Severity Confidence
Severity Reason
Severity History
```

---

# 3.4 Lifecycle — 8 Points

## Requirement

Incidents must follow an explicit, controlled lifecycle.

Initial lifecycle:

```text
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

Additional states:

```text
ESCALATED
CANCELLED
```

### Requirements

State transitions must:

* be explicitly defined
* be validated
* be recorded
* preserve previous state
* have a reason
* be triggered by evidence or permitted system logic

The agent must not arbitrarily invent state names.

### Tests

Tests must verify:

* valid transitions
* invalid transitions
* escalation
* monitoring
* resolution
* cancellation
* repeated reports during an active incident
* control/resolution reports

### Dashboard evidence

Display:

* current state
* state history
* transition reason
* transition timestamp
* triggering report/action

---

# 3.5 Conflict Handling — 7 Points

## Requirement

The system must recognize contradictory information instead of silently overwriting previous evidence.

Examples include:

* conflicting severity
* conflicting incident status
* contradictory descriptions
* contradictory physical conditions
* conflicting verification information

### Required behaviour

When conflicting evidence is detected, the system must:

1. Preserve both pieces of evidence.
2. Record the conflict.
3. Reassess the incident.
4. Determine whether automated action remains safe.
5. Request human review where required.

### Important principle

The latest report must not automatically erase earlier evidence.

The system must maintain an evidence history.

### Conflict model

A conflict should contain information such as:

```text
conflict_id
incident_id
report_ids
conflict_type
description
severity
status
requires_human_review
resolution
created_at
```

### Tests

Tests must cover:

* contradictory severity
* contradictory status
* contradictory physical conditions
* conflicting verification information
* conflict resolution
* unresolved conflict
* human-review trigger

### Dashboard evidence

Display:

* active conflicts
* affected reports
* conflict type
* current resolution
* human-review requirement

---

# 3.6 Duplicate Avoidance — 4 Points

## Requirement

The system must prevent repeated reports or repeated processing from producing inappropriate duplicate incidents or duplicate actions.

### Duplicate categories

The implementation should distinguish between:

```text
DUPLICATE REPORT
```

and:

```text
NEW REPORT ABOUT EXISTING INCIDENT
```

These are not necessarily the same thing.

A follow-up report may contain new evidence while still belonging to an existing incident.

### Required behaviour

Duplicate detection must consider:

* report identity
* incident correlation
* content similarity
* location
* category
* available temporal/contextual information

### Action duplicate prevention

The system must also prevent actions such as repeated dispatches when the required service has already been notified for the same incident and no new dispatch is justified.

### Tests

Test:

* exact duplicate
* near duplicate
* repeated service notification
* repeated escalation
* legitimate follow-up report

### Dashboard evidence

Show:

* duplicate classification
* suppressed actions
* reason for suppression

---

# 3.7 Safety — 4 Points

## Requirement

The system must operate inside controlled safety boundaries.

### Safety principles

The language model must not be allowed to:

* invent emergency procedures
* directly manipulate unrestricted application state
* bypass action permissions
* fabricate successful external notifications
* claim contact with real emergency services when no integration exists

### Policy guard

All agent actions must pass through a policy validation layer.

Example:

```text
Agent proposes action
        ↓
Policy Guard
        ↓
Allowed?
   ↙       ↘
 YES       NO
 ↓          ↓
Execute   Reject + Audit
```

### Required safeguards

* schema validation
* action allowlist
* state-transition validation
* duplicate action prevention
* audit logging
* secrets protection
* simulated-service labelling

### Tests

Tests must verify:

* unauthorized action rejection
* invalid state transition rejection
* malformed tool arguments
* duplicate action rejection
* fabricated-success prevention
* secret exclusion from logs

### Dashboard evidence

The dashboard should make clear whether an action is:

```text
SIMULATED
```

or backed by an actual verified integration.

---

# 3.8 Resolution — 2 Points

## Requirement

The system must recognize when an incident has been controlled/resolved and transition it appropriately.

Resolution must be based on evidence rather than merely elapsed time.

### Resolution evidence

Examples include:

* restoration report
* person released
* repair completed
* incident controlled
* service confirms resolution

### Required behaviour

The system must:

* record the resolution evidence
* update incident state
* preserve the previous incident history
* prevent unnecessary new response actions after resolution
* allow reopening/escalation if new evidence justifies it

### Tests

Test:

* explicit resolution
* control report
* restoration
* resolution after conflicting evidence
* new report after resolution

---

# 4. Human Dashboard — 25 Points

The dashboard must make the agent's decisions observable and understandable to a human evaluator.

The dashboard is not merely a visual frontend.

It is an operational view of the incident-processing system.

---

## 4.1 Incident Overview

The dashboard must provide:

* incident list
* incident ID
* location
* category
* severity
* state
* report count
* active actions
* conflict indicators
* last update

---

## 4.2 Incident Detail

Selecting an incident must expose:

```text
Incident
├── Current State
├── Severity
├── Confidence
├── Location
├── Category
├── Reports
├── Evidence
├── Conflicts
├── Actions
├── State History
├── Severity History
└── Audit History
```

---

## 4.3 Agent Transparency

The evaluator must be able to understand:

* what the agent observed
* what evidence influenced its decision
* what action it selected
* why the action was permitted
* what happened after the action
* what the current incident state is

The dashboard should not expose private chain-of-thought.

Instead, it should expose structured decision explanations and evidence.

---

## 4.4 Incident Timeline

Each incident should have a timeline showing events such as:

```text
Report received
        ↓
Report correlated
        ↓
Severity assessed
        ↓
Conflict detected
        ↓
Agent decision
        ↓
Service notified
        ↓
Follow-up report
        ↓
Incident reassessed
        ↓
Resolution
```

---

## 4.5 Conflict Visibility

Conflicts must be visually obvious.

The dashboard should identify:

* conflicting reports
* unresolved conflicts
* human-review requirements
* affected incident state/severity

---

## 4.6 Action Visibility

The evaluator must be able to see:

* actions selected
* actions executed
* actions rejected
* duplicate actions suppressed
* service destination
* action reason
* result

---

## 4.7 Evaluation Replay

The dashboard should provide a way to replay the supplied development scenarios.

The replay system must preserve the exact dataset order.

It must not reorder reports by timestamp.

---

# 5. Technical Defence — 15 Points

The implementation must be explainable by the developer.

The technical defence must be supported by the actual repository.

---

## 5.1 Architecture

Be able to explain:

* frontend
* backend
* database
* incident engine
* correlation engine
* severity engine
* conflict engine
* action engine
* agent
* policy guard
* audit system

---

## 5.2 Agentic Design

Be able to explain why the project is an agentic system rather than a conventional chatbot.

The agent must:

1. Observe application state.
2. Interpret available evidence.
3. Select an available tool/action.
4. Execute the permitted action.
5. Observe the updated state.
6. Continue the workflow.

---

## 5.3 Tool Control

Be able to explain:

* available tools
* tool schemas
* permissions
* validation
* action execution
* failure handling
* duplicate prevention

---

## 5.4 Incident Correlation

Be able to explain how the system distinguishes:

```text
NEW INCIDENT
```

from:

```text
NEW REPORT ABOUT EXISTING INCIDENT
```

including how contradictory evidence is handled.

---

## 5.5 Testing

Be able to demonstrate:

* automated tests
* supplied development dataset processing
* synthetic edge cases
* conflict handling
* duplicate handling
* lifecycle handling
* safety validation

---

## 5.6 Safety

Be able to explain:

* policy enforcement
* action allowlists
* validation
* audit logs
* simulated services
* secret management
* failure handling

---

## 5.7 Technical Trade-offs

The developer must be able to justify important design choices, including:

* deterministic rules versus LLM reasoning
* database choice
* framework choice
* correlation approach
* severity approach
* agent architecture
* dashboard architecture

---

# 6. Dataset Processing Contract

The supplied development/evaluation data must be treated as an event stream.

Each input record contains:

```text
report_id
timestamp
location
category
reported_severity
description
reporter_type
```

Reports must be processed in file order.

### Processing pipeline

```text
Raw Report
    ↓
Validation
    ↓
Normalization
    ↓
Duplicate Detection
    ↓
Incident Correlation
    ↓
Evidence Storage
    ↓
Severity Assessment
    ↓
Conflict Detection
    ↓
Lifecycle Evaluation
    ↓
Agent Decision
    ↓
Policy Validation
    ↓
Action Execution
    ↓
Audit Event
    ↓
Updated Incident State
```

---

# 7. Data Integrity Requirements

The system must preserve:

* original report data
* normalized report data
* processing order
* incident association
* severity history
* state history
* action history
* conflicts
* audit events
* resolution evidence

Original evidence must never be destroyed merely because newer information arrives.

---

# 8. Testing Strategy

Testing must occur at multiple levels.

## Unit Tests

Test individual components:

* normalization
* correlation
* severity
* conflict detection
* state transitions
* duplicate detection
* policy validation

## Integration Tests

Test complete workflows:

```text
Report → Incident → Agent → Action
```

## Scenario Tests

Replay the supplied scenarios:

1. Network outage
2. Smoke/electrical
3. Contractor verification
4. Lift/accessibility

## Edge-Case Tests

Include:

* duplicate reports
* malformed timestamps
* inconsistent casing
* conflicting reports
* repeated reports
* resolution reports
* control reports
* post-resolution reports
* missing fields
* invalid actions
* repeated actions

---

# 9. Traceability Matrix

Every rubric point must eventually map to concrete repository evidence.

| Rubric Area          | Points | Implementation        | Tests                | Dashboard                     | Defence                 |
| -------------------- | -----: | --------------------- | -------------------- | ----------------------------- | ----------------------- |
| Incident correlation |     15 | Correlation Engine    | Correlation tests    | Incident/report relationships | Correlation explanation |
| Actions/services     |     12 | Action Engine + Tools | Action tests         | Action history                | Tool architecture       |
| Severity             |      8 | Severity Engine       | Severity tests       | Severity/history              | Assessment logic        |
| Lifecycle            |      8 | State Machine         | Lifecycle tests      | Timeline/state                | State design            |
| Conflict handling    |      7 | Conflict Engine       | Conflict tests       | Conflict panel                | Evidence preservation   |
| Duplicate avoidance  |      4 | Duplicate Detector    | Duplicate tests      | Suppression indicators        | Deduplication logic     |
| Safety               |      4 | Policy Guard          | Safety tests         | Action status                 | Safety controls         |
| Resolution           |      2 | Resolution Logic      | Resolution tests     | Resolution timeline           | Resolution design       |
| Human dashboard      |     25 | Operations UI         | UI/integration tests | Dashboard                     | Demo walkthrough        |
| Technical defence    |     15 | Entire architecture   | Full test suite      | Observable evidence           | Technical explanation   |

---

# 10. Definition of Done

The project is not complete until all of the following are true:

* [ ] Application runs locally.
* [ ] Database schema is implemented.
* [ ] Reports can be ingested.
* [ ] Reports are processed in file order.
* [ ] Reports are normalized.
* [ ] New incidents can be created.
* [ ] Reports can be correlated with existing incidents.
* [ ] Duplicate reports are detected.
* [ ] Severity is assessed.
* [ ] Severity changes are recorded.
* [ ] Incident lifecycle is enforced.
* [ ] Conflicting evidence is preserved.
* [ ] Conflicts can trigger human review.
* [ ] Agent can observe incident state.
* [ ] Agent can select controlled tools.
* [ ] Tool inputs are validated.
* [ ] Actions pass through a policy guard.
* [ ] Duplicate actions are prevented.
* [ ] Actions are audited.
* [ ] Services are represented correctly.
* [ ] Resolution is recognized.
* [ ] Incidents can be monitored.
* [ ] Dashboard exposes incident state.
* [ ] Dashboard exposes evidence.
* [ ] Dashboard exposes actions.
* [ ] Dashboard exposes conflicts.
* [ ] Dashboard exposes timelines.
* [ ] Supplied development scenarios can be replayed.
* [ ] Synthetic edge cases are tested.
* [ ] No hidden evaluation data is used.
* [ ] No secrets are committed.
* [ ] External libraries/models are documented.
* [ ] Full test suite passes.
* [ ] Technical defence documentation exists.
* [ ] Final repository is clean and reproducible.

---

# 11. Engineering Principle

The project must be built around the following principle:

> The application owns the truth. The agent operates within controlled tools, policies and state.

The language model is therefore not the unrestricted authority over the crisis system.

The application determines:

* what information exists
* what state the incident is in
* which actions are permitted
* whether an action has already occurred
* whether evidence conflicts
* whether human review is required

The agent assists with reasoning and action selection inside those boundaries.

---

# 12. Completion Standard

The final system should allow an evaluator to follow an incident from:

```text
REPORT
  ↓
CORRELATION
  ↓
EVIDENCE
  ↓
SEVERITY
  ↓
STATE
  ↓
AGENT DECISION
  ↓
POLICY CHECK
  ↓
ACTION
  ↓
NEW EVIDENCE
  ↓
REASSESSMENT
  ↓
RESOLUTION
```

and determine why every significant system decision occurred.
