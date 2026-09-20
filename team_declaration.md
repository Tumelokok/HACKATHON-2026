# Team Declaration

## Campus Crisis Agent — HACKATHON 2026 2ND SEMESTER Student Challenge

### Team composition

**Tumelo** — sole contributor.

This submission was produced by Tumelo alone. Two other students were
originally assigned to the team, but neither contributed to this
repository or this submission. They are not named as contributors
because naming them would misrepresent the work.

### Contribution

The entire submission was authored by Tumelo, from initial repository
creation to the frozen state:

**Domain pipeline (deterministic, application-owned truth)**
- Report validation, normalization, and processing entry point
- Incident correlation engine with location, category, description,
  context, and activity scoring; duplicate detection including
  declared duplicates and semantic markers; ambiguous-match handling
- Monotonic severity engine with safety floor, control-evidence
  lowering, and severity-conflict detection
- Conflict engine with severity, factual, state, location, and category
  contradiction detection, including authorization-versus-verification
  contradiction
- Incident lifecycle engine with an explicit valid-transition table,
  resolution evidence requirements, and human-review gating
- Action policy with applicability rules, idempotency keys, duplicate
  suppression, and justified-repeat support
- Bounded agent that proposes actions and never executes or mutates state

**Application orchestration layer**
- Coordinates the engines, drives the lifecycle intent loop, and
  produces the structured orchestration result consumed by the output
  and dashboard layers

**Output contract**
- Translation layer mapping internal domain vocabulary to the external
  JSONL contract required by the Technical and Submission Guide
- CLI (`scripts/run_predictions.ts`) that reads the development CSV,
  runs each report through the pipeline in file order, and writes
  `predictions.jsonl` and `dashboard-data.json`

**Dashboard**
- Landing page with summary counts and judge-scenario tiles
- Incident Summary view with scene filtering
- Incident Detail view showing current assessment, report timeline,
  action history, and lifecycle transitions including rejected attempts
- Decision Log view with scene and relationship filters
- Replay view running the four judge scenarios through the same
  pipeline, with per-report trace and per-assertion results
- Shared navigation and badge components

**Replay harness and tests**
- End-to-end replay harness exercising all four judge scenarios
- Domain test suite covering report input, severity, lifecycle,
  conflicts, correlation, actions, agent, orchestration, replay, and
  report processing

**Submission pack**
- README, architecture description, team declaration

### Verification at freeze

- Domain test suite: 217 / 217 passing
- Replay harness: 13 / 13 passing, all four scenarios pass their
  rubric assertions
- Development data: 150 predictions, 13 incidents, 0 standalone
  reports, full JSONL vocabulary coverage
- Build and lint: clean

### Signed

Tumelo
