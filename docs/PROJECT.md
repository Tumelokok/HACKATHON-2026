# Campus Crisis Agent

## 1. Project Overview

Campus Crisis Agent is an Agentic AI system designed to process campus incident reports sequentially and maintain an evolving understanding of incidents.

The system does not treat every report as a separate incident. Instead, each incoming report is treated as evidence that may:

* create a new incident;
* update an existing incident;
* corroborate existing evidence;
* conflict with existing evidence;
* duplicate an existing report;
* resolve or help control an incident.

The agent continuously updates incident state as new evidence arrives.

## 2. Core Agent Behaviour

The system follows the lifecycle:

**Observe → Correlate → Assess → Decide → Act → Record → Monitor → Reassess**

### Observe

Read the incoming report without assuming that its category, severity, location or timestamp is completely reliable.

### Correlate

Determine whether the report belongs to an existing incident or represents a new incident.

Correlation should consider multiple signals including:

* location;
* category;
* description;
* semantic similarity;
* evidence of the same event;
* temporal context where reliable;
* existing incident state.

The system must not rely on a shared incident ID from the input.

### Assess

Update the incident's:

* type;
* location;
* severity;
* confidence;
* evidence;
* current status;
* services involved;
* action history.

### Decide

Determine what should happen next based on the current incident state and the new evidence.

Possible decisions include:

* creating an incident;
* updating an incident;
* corroborating evidence;
* identifying conflicting evidence;
* avoiding duplicate action;
* escalating;
* requesting human review;
* monitoring;
* controlling the incident;
* resolving the incident.

### Act

Select appropriate campus services and actions.

The system must avoid unnecessary repeat dispatches when an appropriate response is already active.

### Record

Persist the decision, incident state and action history so that every decision is traceable.

### Monitor

Continue evaluating the incident as new reports arrive.

### Reassess

When new evidence conflicts with previous evidence or changes the situation, the system must update its assessment rather than blindly following its previous decision.

## 3. Primary Goals

The system must perform well in the following areas:

1. Incident correlation
2. Action and service selection
3. Severity assessment
4. Incident lifecycle management
5. Conflicting and changing evidence
6. Duplicate-action avoidance
7. Safety and human oversight
8. Resolution and closure

## 4. Required Dashboard

The dashboard must provide four primary views.

### Incoming Report

Displays the report currently being processed.

### Decision Log

Displays:

* report ID;
* incident ID;
* relationship;
* severity;
* confidence;
* decision;
* service;
* incident status;
* concise reasoning.

### Incident Summary

Displays every active or historical incident with:

* incident ID;
* current type;
* location;
* severity;
* confidence;
* associated reports;
* services;
* current status;
* latest action.

### Action History

Displays:

* incident;
* action;
* service;
* time;
* outcome/status.

New actions must be distinguishable from continued responses.

## 5. Required Prediction Output

The system must generate exactly one JSON object per processed report in JSONL format.

Each prediction must contain:

```json
{
  "report_id": "R104",
  "incident_id": "I003",
  "relationship": "CORROBORATION",
  "severity": "CRITICAL",
  "confidence": 0.92,
  "actions": [
    {
      "type": "CONTINUE_RESPONSE",
      "service_id": "SVC-FIRE"
    }
  ],
  "incident_status": "ESCALATED",
  "human_review": false
}
```

### Relationship values

* `NEW`
* `UPDATE`
* `CORROBORATION`
* `CONFLICT`
* `DUPLICATE`
* `RESOLUTION`

### Severity values

* `LOW`
* `MEDIUM`
* `HIGH`
* `CRITICAL`

### Incident status values

* `INVESTIGATING`
* `ACTIVE`
* `ESCALATED`
* `CONTROLLED`
* `RESOLVED`

### Action types

Supported action types include:

* `DISPATCH`
* `NOTIFY`
* `REQUEST_INSPECTION`
* `REQUEST_VERIFICATION`
* `ESCALATE_RESPONSE`
* `CONTINUE_RESPONSE`
* `CREATE_TICKET`
* `MONITOR`
* `CLOSE_INCIDENT`
* `NO_NEW_ACTION`

`CONTINUE_RESPONSE` means that the existing response remains appropriate. It must not be treated as another dispatch.

## 6. Design Principles

### Evidence over labels

Input category and reported severity are reporter-provided evidence rather than ground truth.

### State over individual reports

The agent must maintain incident state rather than making isolated decisions for every report.

### Confidence must evolve

Confidence should increase when independent evidence corroborates an incident and decrease or become uncertain when credible conflicting evidence appears.

### Safety before automation

The system should request human review when consequences are significant or uncertainty makes autonomous action inappropriate.

### No unnecessary dispatches

Repeated reports about an already-managed incident should not automatically generate additional dispatches.

### Explainability

Every decision should have a concise, traceable reason that allows a judge or operator to understand why the agent acted.

### Deterministic output

Given the same input sequence and configuration, the system should produce reproducible decisions.

## 7. Development Strategy

The system will initially be developed and tested against the supplied development dataset.

The architecture will be designed to handle:

* missing values;
* inconsistent capitalization;
* misspellings;
* inconsistent categories;
* unreliable timestamps;
* duplicate reports;
* conflicting reports;
* changing incident severity;
* long-running incidents;
* resolution and reopening.

The hidden evaluation dataset must not be accessed or used for tuning.

## 8. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │   Campus Reports    │
                    │       CSV           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Report Ingestion   │
                    │   & Validation      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Evidence Extraction │
                    │  & Normalisation    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Incident Correlator │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Incident State    │
                    │       Store         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Assessment Engine   │
                    │ Severity/Confidence │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Decision & Safety  │
                    │       Engine        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Action/Service      │
                    │      Selector       │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
          ┌─────────────────┐   ┌─────────────────┐
          │ predictions.jsonl│   │    Dashboard    │
          └─────────────────┘   └─────────────────┘
```

## 9. Agentic Design

The system is considered agentic because it maintains state and repeatedly makes decisions based on changing evidence.

The agent does not simply ask an LLM to answer a question.

Instead, it operates as a controlled decision loop:

```text
New Report
    ↓
Understand Evidence
    ↓
Find Candidate Incidents
    ↓
Compare Evidence
    ↓
Update Incident State
    ↓
Assess Risk
    ↓
Select Decision
    ↓
Determine Action
    ↓
Apply Safety Constraints
    ↓
Record Result
    ↓
Wait for Next Report
```

## 10. Initial Technical Direction

The implementation will use a hybrid architecture rather than relying exclusively on an LLM.

The system should combine:

* deterministic validation and normalisation;
* rule-based safety constraints;
* structured incident state;
* semantic or similarity-based correlation;
* confidence scoring;
* state-machine lifecycle management;
* service/action selection;
* optional AI/LLM reasoning where it provides measurable value.

The exact technology choices will be finalized after the repository foundation and development-data analysis are complete.

## 11. Success Criteria

The project is successful when:

* all development reports can be processed sequentially;
* incidents are correctly clustered;
* duplicate reports do not cause unnecessary dispatches;
* severity changes as evidence changes;
* conflicting evidence is represented explicitly;
* incident states evolve correctly;
* appropriate services are selected;
* human review is requested when appropriate;
* incidents can become controlled or resolved;
* predictions are valid JSONL;
* the dashboard reflects the same decisions as the prediction output;
* the complete system can be demonstrated through a controlled replay.

