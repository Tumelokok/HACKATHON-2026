# Campus Crisis Agent — Agent Specification

## 1. Purpose

The Campus Crisis Agent is a bounded AI decision engine operating inside the Campus Crisis Agent application.

The agent assists with incident interpretation and response selection.

It does not own application truth.

The application owns:

* incident state
* evidence
* permissions
* safety rules
* action execution
* audit history

---

# 2. Agent Loop

The agent follows a controlled observe-decide-act-observe cycle.

```text
┌──────────────────────┐
│ Observe Incident     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Analyse Evidence     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Select Tool / Action │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Policy Validation    │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Execute Tool         │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Observe New State    │
└──────────┬───────────┘
           │
           └──────────────→ Continue / Resolve
```

---

# 3. Agent Responsibilities

The agent may:

* inspect incident information
* inspect related reports
* inspect incident state
* inspect severity
* inspect conflicts
* identify missing information
* select permitted actions
* request human review
* select escalation
* request additional location information
* recommend resolution when sufficient evidence exists

---

# 4. Agent Restrictions

The agent must not:

* directly modify the database
* invent tools
* invent services
* bypass the policy guard
* bypass state validation
* bypass duplicate detection
* fabricate successful actions
* claim to contact real emergency services without an integration
* delete evidence
* overwrite contradictory reports
* create arbitrary incident states

---

# 5. Tool Interface

Tools are application-controlled functions.

Initial conceptual tools:

```text
get_incident
update_incident
assess_risk
notify_security
notify_trusted_contact
request_location
close_incident
```

Additional domain-specific services may be introduced where required by the evaluation scenarios.

Every tool must have:

* a defined name
* defined input schema
* defined output schema
* permission requirements
* validation
* audit behaviour
* failure behaviour

---

# 6. get_incident

Purpose:

Retrieve the current incident state and relevant evidence.

Input:

```text
incidentId
```

Output should contain structured information including:

```text
incident
severity
state
reports
conflicts
actions
review status
```

The tool must not expose unnecessary sensitive information.

---

# 7. update_incident

Purpose:

Request an application-controlled incident update.

The tool must not allow arbitrary fields or arbitrary state values.

Updates must pass through domain validation.

---

# 8. assess_risk

Purpose:

Request or perform a structured severity assessment.

The result should contain:

```text
severity
confidence
reason
evidence
```

The final severity is stored by the application.

---

# 9. Notification Tools

Examples:

```text
notify_security
notify_trusted_contact
```

These tools represent controlled service integrations.

During the hackathon, notifications may be simulated.

The system must clearly indicate simulated execution.

---

# 10. request_location

Purpose:

Request additional location information when the available incident information is insufficient.

The request must be represented as an auditable action.

---

# 11. close_incident

Purpose:

Request incident closure after credible resolution evidence exists.

Closure must pass application lifecycle validation.

The agent cannot force an invalid state transition.

---

# 12. Tool Selection

The agent should return structured decisions.

Example:

```text
{
  "action": "NOTIFY_SECURITY",
  "reason": "Evidence indicates an active safety threat at a known campus location.",
  "confidence": 0.94
}
```

The application then validates the decision.

The textual reason is for observability and explanation.

It is not itself the authorization mechanism.

---

# 13. Policy Validation

The policy layer determines whether the selected action is permitted.

Example:

```text
Agent:
NOTIFY_SECURITY

Policy:
Allowed?

Conditions:
- incident exists
- incident is not cancelled
- action is applicable
- action is not an inappropriate duplicate
- required information exists
- no safety rule blocks execution

Result:
APPROVED / REJECTED
```

---

# 14. Agent Decision Record

Agent decisions should be recorded in structured form.

Example:

```text
AgentDecision
├── incidentId
├── selectedAction
├── confidence
├── structuredReason
├── evidenceReferences
├── policyResult
└── createdAt
```

The dashboard may display the structured reason and evidence references.

Private chain-of-thought must not be stored or displayed as an application requirement.

---

# 15. Agent Failure

If the AI model is unavailable or returns an invalid response:

```text
Agent Failure
      ↓
Validate Failure
      ↓
Do Not Execute Unsafe Action
      ↓
Record Failure
      ↓
Request Human Review / Use Deterministic Fallback
```

The incident must remain observable.

The system must not fabricate a successful response.

---

# 16. Deterministic Fallbacks

Critical application behaviour must not depend exclusively on model availability.

Examples:

* state validation
* duplicate action detection
* action authorization
* severity constraints
* conflict recording
* audit logging

These remain application-controlled.

---

# 17. Agentic System Definition

The project qualifies as agentic when the agent can:

1. Observe incident state.
2. Interpret available evidence.
3. Select from available tools.
4. Request an action.
5. Receive the result.
6. Observe the updated incident state.
7. Continue the workflow.

This is distinct from a chatbot that only produces text.

---

# 18. Agent Success Criteria

The agent implementation is successful when:

* it can inspect incidents
* it can inspect evidence
* it can identify appropriate next actions
* it uses controlled tools
* invalid tool requests are rejected
* duplicate actions are prevented
* actions are audited
* conflicts can trigger human review
* the incident can continue through its lifecycle
* the application remains authoritative over safety and state
