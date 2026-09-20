# Application Orchestration

The orchestration layer coordinates the authoritative deterministic domain engines. It does not replace validation, normalization, correlation, severity, conflicts, lifecycle, action policy, or simulated execution.

## Pipeline

```text
REPORT
  -> processReport
  -> deterministic context
  -> orchestrator lifecycle intent
  -> lifecycle engine validation
  -> bounded agent observation/decision
  -> application fallback recommendations
  -> action policy
  -> simulated executor
  -> audit/history
```

`orchestrateReport` is the application entry point for one ordered report. It carries correlation, severity, conflict, lifecycle, and action state forward without sorting by timestamp.

## Lifecycle Intents

The orchestrator uses application intents such as `ASSESS`, `ACTIVATE`, `RESPOND`, `MONITOR`, `ESCALATE`, `RESOLVE`, and `REOPEN`. These are not state mutations. Each intent is converted to a typed request and passed through `processLifecycleTransition`. Rejected transitions leave state unchanged and remain observable in the result.

A single report may produce several evidence-backed transitions, such as `CREATED -> ASSESSING -> ACTIVE -> RESPONDING`. The lifecycle engine validates every hop.

## Actions and Fallback

The bounded agent remains proposal-only. The orchestrator also provides deterministic evidence-driven recommendations when no model is present:

- network evidence can recommend `NOTIFY_ICT`
- smoke/electrical or serious danger can recommend security and maintenance
- uncertain contractor verification can recommend human review and security
- lift/accessibility evidence can recommend maintenance

Every recommendation is submitted to the existing action policy. Only approved actions reach the simulated executor. Duplicate proposals remain in the orchestration result and are suppressed by the existing action state.

## Safety and Review

Ambiguous correlation, duplicates, unresolved conflicts, cancelled incidents, invalid lifecycle transitions, and unsupported actions do not bypass safety boundaries. Human review is represented as requested/pending evidence only; no human approval is fabricated. Reports remain untrusted evidence, including prompt-injection-like text.

## Replay

The replay harness delegates each report to this orchestration entry point. Its trace exposes lifecycle intents/results, agent decisions, action policy/execution, audit events, and deterministic evaluation assertions for the four judge scenarios.
