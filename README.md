# Campus Crisis Agent

HACKATHON 2026 2ND SEMESTER — Campus Crisis Agent Student Challenge.

An agentic system that processes campus reports in sequence and
maintains an evolving understanding of incidents. A report is evidence,
not necessarily a separate incident.

Team: see `team_declaration.md`.

## What the system does

The system runs a fixed pipeline for every report, in the order the
reports appear in the input file:


- **Observe** — the report is validated and normalized. Malformed
  timestamps and inconsistent labels are preserved as evidence rather
  than discarded.
- **Correlate** — the report is scored against existing incidents on
  location, category, description overlap, follow-up context, and
  processing-order activity. It is classified as a new incident, an
  update to an existing incident, a duplicate, or an ambiguous match
  that requires human review.
- **Assess** — severity is recalculated for the whole incident with a
  monotonic safety floor: control evidence can lower the live level but
  cannot erase the historical floor established by danger evidence.
- **Decide** — a bounded agent reads the structured context and proposes
  an action. The agent cannot execute, cannot mutate state, and cannot
  bypass policy.
- **Act** — the action policy evaluates the proposal, suppresses
  duplicates, and executes approved actions against simulated services.
- **Record** — every decision, action, and lifecycle transition is
  appended to history.
- **Monitor** — the incident lifecycle moves through an explicit
  valid-transition table. Resolution requires credible evidence and is
  refused while an unresolved safety conflict is open.
- **Reassess** — every subsequent report re-enters the pipeline against
  the accumulated incident state.

The application owns truth. The agent is bounded decision support.

## Setup

One command, from a clean checkout:


## Run the dashboard


Then open `http://localhost:3000`.

## Generate predictions


This reads `data/campus_reports.csv` and writes `predictions.jsonl`
and `dashboard-data.json` to the repository root.

The dashboard reads `dashboard-data.json`. Generate it before starting
the dashboard, or the dashboard will show an error explaining the
missing file.

## Optional commands


## Judge scenarios

The four scenarios the judges replay are defined in
`src/domain/replay/scenarios.ts` and executed by `npm run replay`.
They can also be stepped through in the dashboard at `/replay`.

- **NETWORK_OUTAGE** — campus-wide network outage; duplicate detection,
  correlated follow-ups, recovery, and policy-reviewed dispatch.
- **SMOKE_ELECTRICAL** — smoke and electrical danger; severity
  escalation, contradictory evidence, controlled resolution evidence.
- **CONTRACTOR_VERIFICATION** — unverified contractor access; conflicting
  authorization claims, human review, security coordination.
- **LIFT_ACCESSIBILITY** — lift failure with trapped passenger;
  escalation, accessibility impact, resolution, and reopening when the
  danger returns.

Each scenario carries its own rubric assertions, which `npm run replay`
checks and reports.

## Dashboard views

| Required view | Route | What it shows |
|---|---|---|
| Incoming Report | `/incidents/[id]` | Latest report and current assessment at the top of each incident |
| Decision Log | `/decisions` | Every processed report in supplied order, filterable by scene and relationship |
| Incident Summary | `/incidents` | Current type, location, severity, confidence, services, status, and review flag for every incident |
| Action History | `/incidents/[id]` | Actions per report with service, and whether each was a new action or a continued response |
| Replay | `/replay` | The four judge scenarios run through the same pipeline, with per-report trace and per-assertion results |

## Input data

- `data/campus_reports.csv` — development reports. Each row contains
  `report_id`, `timestamp`, `location`, `category`, `reported_severity`,
  `description`, `reporter_type`. Reports are processed in file order.
  Timestamps are never used to reorder.
- `data/campus_services.csv` — fictional campus service directory.

## Output

`predictions.jsonl` contains exactly one JSON object per processed
report, conforming to the Technical and Submission Guide contract:

- `report_id`
- `incident_id`
- `relationship`: NEW, UPDATE, CORROBORATION, CONFLICT, DUPLICATE, RESOLUTION
- `severity`: LOW, MEDIUM, HIGH, CRITICAL
- `confidence`: number in 0..1
- `actions`: array of `{type, service_id?}`; `[]` means no new action
- `incident_status`: INVESTIGATING, ACTIVE, ESCALATED, CONTROLLED, RESOLVED
- `human_review`: boolean

## Dependencies

Runtime:
- next 16.3.5
- react 19.2.8
- react-dom 19.2.8
- @prisma/client ^7.10.0 (design-time only; not used at runtime)

Development:
- typescript ^5
- tsx ^4.23.x
- vitest ^4.1.11
- eslint ^9, eslint-config-next 16.3.5
- tailwindcss ^4, @tailwindcss/postcss ^4
- @types/node ^20, @types/react ^19, @types/react-dom ^19
- prisma ^7.10.0 (design-time only; not used at runtime)

Full resolved versions are pinned in `package-lock.json`.

## Environment variables

None required.

This system makes no external network calls and uses no AI service at
runtime. The agent runs entirely on the deterministic rule engine in
`src/domain/agent`. No API keys, tokens, or secrets are used. There is
no `.env` file and no environment variable is read by the application.

## Layout

- `src/domain/` — deterministic domain engines: validation,
  normalization, correlation, severity, conflicts, lifecycle, actions,
  bounded agent, orchestration, replay
- `src/output/` — translation layer producing the JSONL contract
- `src/dashboard/` — dashboard data types, loader, and helpers
- `src/app/` — Next.js App Router pages
- `scripts/run_predictions.ts` — prediction CLI
- `data/` — development corpus and service directory
- `docs/` — architecture and per-engine documentation
- `tests/` — domain test suite

## Known limitations

- **No external AI service.** The agent uses a deterministic rule
  engine. A model can be plugged in through the `AgentModel` interface
  but is not required and is not used in the frozen submission.
- **Simulated services.** Actions are executed against simulated
  services. No real dispatch, notification, or ticket system is
  contacted.
- **Correlation thresholds are fixed.** The scoring weights and the
  0.50 / 0.75 thresholds are configured, not learned. They were tuned
  on the development corpus and may not generalise perfectly to
  different report vocabularies.
- **Resolution evidence is phrase-based.** The lifecycle engine
  recognises a fixed set of resolution phrases. Reports that express
  resolution in unusual wording may not trigger closure.
- **Conflict detection covers specific patterns.** Explicit negation,
  severity descents, materially different locations, incompatible
  categories, and authorization-vs-verification pairs are detected.
  Other kinds of factual contradiction may not be.
- **The dashboard reads a generated file.** `dashboard-data.json` must
  be regenerated after any change to the pipeline or the input data.
- **No database at runtime.** The Prisma schema is a design document
  only; it is not used by the application.

## Architecture

See `architecture.md` for the full pipeline description and `docs/`
for per-engine documentation.
