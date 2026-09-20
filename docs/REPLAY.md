# Replay and Evaluation Harness

The replay harness exercises the actual validation, normalization, correlation, severity, conflict, lifecycle, agent, action-policy, simulated-execution, and audit contracts in file order.

## Processing Order

`processingOrder` is the supplied scenario array index. Reports are never sorted by timestamp. Malformed timestamps remain in the trace as evidence.

## Scenarios

The deterministic fixtures cover:

- `NETWORK_OUTAGE`: outage progression, duplicate, recovery, and policy review.
- `SMOKE_ELECTRICAL`: danger escalation, contradictory evidence, conflict review, and control evidence.
- `CONTRACTOR_VERIFICATION`: uncertain access, conflicting verification, and human-review signals.
- `LIFT_ACCESSIBILITY`: trapped passenger, accessibility impact, maintenance follow-up, resolution, and renewed evidence.

## Evaluation

Each scenario returns a machine-readable trace, summary counters, and assertions mapped to the rubric categories: incident correlation, actions/services, severity, lifecycle, conflict handling, duplicate avoidance, safety, and resolution.

The harness reports PASS/FAIL evidence. It does not claim hackathon points.

## Determinism and Negative Tests

Replay uses no database, network service, random ID, or LLM. Normalized evaluation output removes runtime-specific date representation while preserving report order, decisions, evidence IDs, policy results, execution status, and audit events.

Tests cover out-of-order timestamps, malformed timestamps, duplicates, conflicts, prompt-injection-like evidence, and repeated deterministic runs.

## Running

Run `npm test` to execute replay and domain tests. The replay trace is currently an in-memory test/evaluation result; a later dashboard can consume the same structured result without changing domain rules.

## Limitations

Persistence, dashboard rendering, real services, and a model provider are intentionally outside this harness. Lifecycle transitions and action execution remain explicit application decisions rather than automatic side effects of every report.