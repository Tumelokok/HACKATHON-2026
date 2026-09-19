# Campus Crisis Agent

## 1. Project Overview

Campus Crisis Agent is an AI-powered crisis-response system designed to help coordinate responses to incidents affecting students and campus communities.

The system allows a user to report a crisis or potential threat. An agentic decision engine analyses the available incident information, determines the current risk level, manages the incident state and selects appropriate system actions.

The system is designed to demonstrate how an AI agent can operate within a controlled software environment using defined tools, rules and application state rather than simply generating conversational responses.

---

## 2. Core Problem

During a crisis, users may be stressed, frightened or unable to determine what action should be taken next.

Traditional reporting systems often depend on the user knowing which person or service to contact and manually coordinating the response.

Campus Crisis Agent aims to reduce this coordination burden by allowing the system to assess the reported situation and initiate appropriate predefined response actions.

---

## 3. MVP Goal

The minimum viable product must demonstrate the following complete workflow:

1. A user creates an incident.
2. The system records the incident.
3. The agent analyses the available information.
4. The agent determines a risk level.
5. The incident receives an appropriate state.
6. The agent selects an appropriate response action.
7. The system executes the permitted action.
8. The incident remains observable and can be updated.
9. The incident can eventually be resolved.

---

## 4. Incident Risk Levels

The system will initially support four risk levels:

* LOW
* MEDIUM
* HIGH
* CRITICAL

Risk assessment must use defined criteria and must not rely solely on unrestricted language-model output.

---

## 5. Incident States

The initial incident lifecycle is:

CREATED
→ ASSESSING
→ ACTIVE
→ RESPONDING
→ MONITORING
→ RESOLVED

Additional states:

* ESCALATED
* CANCELLED

State transitions must be explicitly defined and testable.

---

## 6. Agent Responsibilities

The agentic decision engine may:

* analyse incident information
* assess risk
* retrieve incident state
* update incident state
* determine appropriate permitted actions
* request additional information
* initiate permitted notifications
* escalate incidents according to predefined rules
* monitor incident state
* determine when an incident can move toward resolution

The agent must operate through controlled application tools.

---

## 7. Agent Tools

The initial tool set may include:

* `get_incident`
* `update_incident`
* `assess_risk`
* `notify_security`
* `notify_trusted_contact`
* `request_location`
* `close_incident`

Tools must have clearly defined inputs, outputs and permissions.

---

## 8. Safety Principles

The system must:

* keep emergency actions within predefined system rules
* avoid allowing the language model to invent emergency procedures
* maintain an auditable incident history
* validate important actions before execution
* protect sensitive user information
* keep secrets and API keys outside the repository
* clearly distinguish simulated actions from real emergency services during the hackathon

The prototype must not claim to contact real emergency services unless an actual verified integration exists.

---

## 9. Demonstration Scenario

The primary demonstration scenario should involve a user reporting a potential threat.

Example:

"Someone is following me near the library. I am scared."

The system should demonstrate:

1. Incident creation
2. Information extraction
3. Risk assessment
4. Incident state transition
5. Agent decision
6. Notification/escalation
7. Continued incident monitoring
8. Resolution

---

## 10. Technical Objective

The project should demonstrate an agentic architecture rather than a conventional chatbot.

The agent should be capable of:

* observing application state
* reasoning about the current incident
* selecting from available tools
* executing permitted actions
* observing updated state
* continuing the incident workflow

---

## 11. Development Constraints

The development team will initially use a single `main` branch.

Major milestones must be committed and pushed to GitHub.

The team must:

* test against the supplied development dataset
* avoid hidden evaluation data
* document external libraries and models
* keep secrets out of Git
* ensure each team member understands their contributions

---

## 12. Success Criteria

The MVP is successful when the team can demonstrate a complete incident lifecycle from initial report through agent assessment, response coordination, monitoring and resolution.

The system should be understandable enough that a technical evaluator can inspect the architecture and determine:

* what the agent observes
* what decisions it makes
* which tools it can use
* why an action was selected
* how incident state changes
* how the system prevents uncontrolled actions
* how the workflow is tested
