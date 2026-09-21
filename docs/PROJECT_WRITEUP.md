# Campus Crisis Agent — Project Writeup

HACKATHON 2026 2ND SEMESTER — Campus Crisis Agent Student Challenge.

Sole contributor: Tumelo. See `team_declaration.md`.

---

## 1. What the challenge asked for

Build an agentic system that processes campus reports in sequence and
maintains an evolving understanding of incidents. A report is evidence,
not necessarily a separate incident. The pipeline must follow:
Observe → Correlate → Assess → Decide → Act → Record → Monitor → Reassess

text

The brief is explicit that a chatbot connected to an LLM does not by
itself meet the challenge. Judges score clarity and observability, not
visual polish. The four judge scenarios are network outage,
smoke/electrical, contractor verification, and lift/accessibility.

---

## 2. What we built

A deterministic pipeline. The application owns truth. A bounded agent
sits at the decision point and can only propose.
report
→ validation (required fields, processing order)
→ normalization (locations, categories, severities)
→ correlation (new / existing / duplicate / ambiguous)
→ severity (monotonic safety floor)
→ conflict detection (five contradiction types)
→ lifecycle (explicit valid-transition table)
→ agent decision (bounded, cannot execute)
→ action policy (applicability, idempotency, suppression)
→ simulated execution
→ audit / history

text

Every stage is a pure function in `src/domain/`. Nothing in the domain
layer calls out to a network, a database, or a model.


---

## 3. Architecture, stage by stage

**Validation and normalization.** Required fields are checked. Blank,
missing, or malformed values are reported as issues but the report is
still processed. A malformed timestamp is preserved as raw evidence and
the report is not reordered — the brief says an unseen timestamp may be
malformed, and file order is the only ordering.

**Correlation.** Every report is scored against existing incidents on
five weighted components: location similarity (0.35), category match
(0.20), description token overlap (0.25), follow-up context (0.10), and
processing-order activity (0.10). The total score places the report in
one of three bands:

- below 0.50 — new incident
- 0.50 to 0.75 — ambiguous, attached to the best candidate and flagged
  for human review
- 0.75 and above — matched to an existing incident

Duplicates are detected two ways: an exact report ID repeat, and a
declared duplicate marker in the description ("duplicate report:",
"repeat report:").

Ambiguous matches are attached to the candidate incident rather than
orphaned. An earlier version refused to attach them, which left 58 of
150 development reports standalone. Attaching them and flagging
`human_review` preserves the evidence while still surfacing the
uncertainty.

**Severity.** Every report is assessed against critical phrases, high
indicators, medium indicators, and reported severity. A monotonic
safety floor is maintained: control evidence can lower the live level
but cannot erase the historical floor established by danger evidence.
Once an incident has been HIGH, a later "resolved" report drops the
live level but the incident's severity history remembers the HIGH.

**Conflict detection.** Five contradiction types are detected between
adjacent reports in an incident's evidence list:

- SEVERITY_CONTRADICTION — a later report asserts a lower severity
  without being a control report
- FACTUAL_CONTRADICTION — explicit negation of fire, smoke, sparks, or
  trapped, plus authorization claims contradicted by an inability to
  verify
- STATE_CONTRADICTION — active danger followed by a normal-operation or
  repair claim
- LOCATION_CONTRADICTION — materially different normalized locations
- CATEGORY_CONTRADICTION — materially incompatible category pairs

Any conflict sets `requiresHumanReview` and reduces confidence.

**Lifecycle.** An explicit valid-transition table:
CREATED → ASSESSING, CANCELLED
ASSESSING → ACTIVE, RESPONDING, ESCALATED, CANCELLED
ACTIVE → RESPONDING, ESCALATED, MONITORING, RESOLVED
RESPONDING → MONITORING, ESCALATED, RESOLVED
MONITORING → ACTIVE, RESPONDING, ESCALATED, RESOLVED
ESCALATED → RESPONDING, MONITORING, RESOLVED
RESOLVED → ACTIVE, ESCALATED
CANCELLED → (terminal)

text

Resolution requires credible evidence — a phrase like "repaired and
tested", "hazard removed", "fire extinguished", "resolved", or
"controlled". Resolution is refused while an unresolved safety conflict
is open. Reopening from RESOLVED is permitted when new danger evidence
arrives.

**Bounded agent.** The agent reads a structured context and produces
one of: NO_ACTION, PROPOSE_ACTION, REQUEST_HUMAN_REVIEW,
REQUEST_MORE_INFORMATION, ESCALATE, or PROPOSE_CLOSURE. It cannot
execute, cannot mutate state, and cannot request an arbitrary tool. Its
tool whitelist is seven names. Prompt-injection text in report
descriptions is treated as evidence, not instructions — there are tests
for this.

No model is required. A deterministic fallback runs in its place, and
the `AgentModel` interface allows a model to be plugged in without
changing any other code.

**Action policy.** Every proposal goes through `submitActionProposal`,
which evaluates applicability, lifecycle state, safety, and duplicate
status. Approved actions execute against simulated services. Repeated
equivalent actions are suppressed via idempotency keys unless a
justified repeat is supplied.

**Output contract.** `scripts/run_predictions.ts` reads the CSV, runs
each report through `orchestrateReport` in file order, and writes
`predictions.jsonl` with exactly one line per report, plus
`dashboard-data.json` for the dashboard.

---

## 4. Dashboard

Six views, all server-rendered, all reading the generated data.

| View | Route | Purpose |
|---|---|---|
| Landing | `/` | Summary counts, four judge-scenario tiles, all-incidents tile |
| Incident Summary | `/incidents` | Every incident, filterable by scene |
| Incident Detail | `/incidents/[id]` | Current assessment, report timeline, action history, lifecycle transitions |
| Decision Log | `/decisions` | Every processed report, filterable by scene and relationship |
| Action History | `/actions` | Every action that entered the policy engine, filterable by status and action type |
| Replay | `/replay` | Four judge scenarios, live through the pipeline, with assertions |


---

## 5. Verification

- Domain test suite: 217 tests across 10 files.
- Replay harness: 13 tests, four scenarios, each asserted against
  rubric areas.
- Freeze check: `npm run freeze-check` runs nine checks matching the
  guide's freeze checklist.
- Development corpus: 150 predictions, 13 incidents, 0 standalone,
  full JSONL vocabulary coverage.

Run all of them with:

```bash
npm test
npm run replay
npm run freeze-check
## 6. Challenges faced and how they were addressed

### 6.1 Standalone reports — 58 of 150

Problem. The first version of the correlation engine refused to
attach reports whose match score fell in the ambiguous band. On the
development corpus this orphaned 58 reports — reports that clearly
belonged to an incident but whose score was not high enough to confirm
the match. Every orphaned report lost its evidence from the incident
cluster.

Fix. Attach ambiguous matches to the best candidate incident, and
surface the uncertainty through human_review: true. The rubric
criterion is "related reports share an incident; unrelated reports
remain separate" — orphaning related reports fails the recall half. The
result: 58 standalone reports went to 0.

### 6.2 Severity was being skipped for ambiguous reports

Problem. After fixing the attach behaviour, a report reading "Water
has reached a power extension; the area is becoming unsafe" was showing
as severity: LOW in the output. The cause: shouldAssessSeverity
gated on matchStatus !== "AMBIGUOUS", so ambiguous reports
contributed to the incident's evidence list but not to its severity.
The LOW was not a judgment — it was the ?? "LOW" fallback in the
vocabulary translation layer.

Fix. Remove the ambiguous condition from shouldAssessSeverity
only. Lifecycle transitions stay gated, so ambiguous reports still do
not mutate state — consistent with the existing test that asserts this.
Result: 28 reports changed from CORROBORATION to UPDATE, which is the
correct classification for reports whose evidence changed the incident.

### 6.3 An incident re-resolved in the same cycle it reopened

Problem. Scenario LFT-005 — "Person trapped in the lift again" —
reopened a resolved incident. Then, in the same report cycle, the
intent loop kept running and re-resolved it on the accumulated evidence
of the older LFT-004 resolution report. Four transitions in one cycle,
ending in RESOLVED despite the newest report reasserting the danger.

Fix. Treat reopening as terminal for the current report cycle,
symmetric with the existing resolution early exit. The reopen is
recorded; further progression waits for the next report. LFT-005 now
ends in ACTIVE, with exactly one accepted transition.

### 6.4 Spurious severity conflicts on ordinary progress reports

Problem. The contractor-verification scenario showed three
SEVERITY_CONTRADICTION flags on four reports for what was a routine
uncertainty. The cause: reports that omitted reported_severity in the
fixture inherited a default of "low", and a later LOW against an
earlier MEDIUM fired a severity contradiction — even though the
reporter had not asserted a lower severity at all.

Fix (partial). Adding explicit severities to the affected fixtures
removed the spurious conflicts, but also removed the only signal
satisfying the scenario's conflict-handling assertion — because the
assertion was passing on the spurious conflict, not on a real one.

Fix (final). The real conflict in the contractor scenario is
between "The contractor says they were authorized by maintenance" and
"Security cannot verify the contractor identity." The existing conflict
engine could not see it because its negation mechanism only caught
explicit negation of the same concept. A second detector was added
inside findFactualSignals for authorization claims paired with
verification failures. That emits an existing FACTUAL_CONTRADICTION
signal — no new type required — and the scenario now passes on the
genuine contradiction.


### 6.5 Duplicate conflict signals within a single report

**Problem.** The `R057/R065` severity signal appeared twice in the same
report's `signals` array. `detectConflicts` pushed it once from the
severity assessment's own conflict record and once more from the
adjacent-pair loop.

**Fix.** A `dedupeSignals` helper keyed on `(type, sorted reportIds)`
is applied before sorting. The conflict identity and the first signal
are unchanged; only the duplicate entry is removed. Verified: zero
within-report duplicates in all four scenarios.

An open conflict is still re-reported on subsequent reports while it
remains unresolved. That is deliberate. Suppressing the repeat would
hide an open safety conflict.

### 6.6 The same action proposed twice on one report

**Problem.** The Action History view showed two `NOTIFY_SECURITY`
entries on the same report, both SUPPRESSED. The cause was in
`actionSuggestions`: a high-severity security incident with uncertain
contractor verification matched two separate branches, each pushing
`NOTIFY_SECURITY`. Both entered the policy loop; the second was
suppressed as a duplicate but still appeared in the results array.

**Fix.** Deduplicate `proposalInputs` by action type, keeping the first
occurrence. The agent proposal is appended only if its action type is
not already present. Total actions went from 142 to 129 — 13 duplicate
proposals removed. EXECUTED count unchanged at 19, which confirms the
first occurrence was always the one executing.

### 6.7 Landing page had no way to reach non-scenario incidents

**Problem.** The brief names four judge scenarios. On the development
corpus, 7 of 13 incidents fell outside those four, under `OTHER`. The
landing page tiles filtered to the four scenarios only, so half the
incidents were unreachable from the front page.

**Fix.** Add an "All incidents" tile alongside the four scenario tiles,
linking to `/incidents` unfiltered. The judge-scenario layout is
preserved; the reachability gap is closed.

### 6.8 Build artifacts appearing in git status

**Problem.** `next-env.d.ts` and `tsconfig.tsbuildinfo` are regenerated
by every build, and they alternated content between dev and build
modes, producing working-tree churn and repeated `??` entries in
`git status`.

**Fix.** Untrack `next-env.d.ts` with `git rm --cached`, add both to
`.gitignore`. The files remain on disk; git no longer tracks their
contents. This keeps the working tree clean between milestones.

### 6.9 A broken partial edit

**Problem.** One edit to `run_predictions.ts` was applied partially —
the call site was changed but the imports and a helper were not added,
leaving the file uncompilable.

**Fix.** Revert both modified files with `git restore` and reapply the
change in one complete pass. From that point, each file was verified
with `npx tsc --noEmit` before moving to the next, so a partial state
was caught immediately.

---

## 7. What was not done, and why

- **No separate database at runtime.** A Prisma schema exists as a
  design document. The application uses in-memory state and a generated
  JSON file. The brief does not require a database, and adding one would
  have introduced a dependency with no rubric benefit.
- **No external AI service.** The agent uses a deterministic rule
  engine. A model can be plugged in through the `AgentModel` interface.
  Adding one was not required, would add a runtime dependency, and would
  not improve any rubric criterion — the pipeline is the deliverable,
  not the model.
- **Scene taxonomy limited to the four named by the brief.** Categories
  like MEDICAL, FACILITIES, CLEANING, and ENVIRONMENTAL fall under
  OTHER. Inventing new scene names to cover them would have diverged
  from the brief's own list.
- **No test for the ambiguous-severity fix.** The gate was removed and
  the change verified against the four scenarios and 217 existing
  tests. A dedicated test would be a genuine improvement and was
  consciously deferred to keep the freeze surface small.


---

## 8. How to run it

```bash
npm install           # setup
npm run predictions   # generate predictions.jsonl and dashboard-data.json
npm run dev           # dashboard on http://localhost:3000
bash
npm test              # 217 domain tests
npm run replay        # 13 replay tests, four judge scenarios
npm run freeze-check  # nine freeze-checklist checks
npm run build         # production build
npm run lint          # lint
No environment variables are required. No secrets are used. No external
network calls are made.

## 9. Honest limitations

Correlation thresholds are configured, not learned. They were tuned
on the development corpus and may not generalise perfectly to a
different report vocabulary.
Resolution detection is phrase-based. Reports expressing resolution
in unusual wording may not trigger closure.
Conflict detection covers specific patterns. Other kinds of factual
contradiction may not be caught.
The dashboard reads a generated file. It must be regenerated after any
pipeline change.
The agent has no memory beyond the incident it is looking at. It
reads structured context for one incident and proposes one action.
These are the honest edges of the system. They are stated here rather
than discovered under questioning.

