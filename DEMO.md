# Live Demo Sequence

Roughly 10 minutes. Ordered so every claim can be shown, not described.

Before starting: run `npm run predictions` once so `dashboard-data.json`
is current, then npm run dev and leave it running.

1. Freeze check (1 min)

bash
npm run freeze-check
Nine checks against the repository as it stands. Matches the guide's
freeze checklist.

2. Replay harness (1 min)

bash
npm run replay
Then open http://localhost:3000/replay.

The assertion list under each scenario names its rubric area. Four
scenarios: network outage, smoke/electrical, contractor verification,
lift/accessibility.

3. Reopening a resolved incident (1 min)

On the replay page, click LIFT_ACCESSIBILITY, scroll to the trace.

LFT-004 resolves the incident. LFT-005 reopens it: RESOLVED → ACTIVE.

4. One incident's full lifecycle (3 min)

Open http://localhost:3000/incidents/incident-R001.

Fifteen reports, one incident. Notable rows:

R001 — NEW, medium severity, water pooling
R009–R017 — UPDATE, ambiguous correlation, human review flagged
R025 — water reached a power extension
R033 — "may only be a spilled cleaning bucket", contradiction
R041 — DUPLICATE
R073 onward — CONFLICT
R113 — RESOLUTION attempted
Sections to walk through:

Report timeline — 15 reports in processing order
Lifecycle transitions — includes a rejected MONITORING → MONITORING on R113 with the reason "An unresolved safety-relevant conflict requires human review before resolution"
Action history — Status and Reason columns per action
5. Duplicate avoidance (2 min)

Open http://localhost:3000/actions.

Header shows: 129 actions, EXECUTED: 19 · REJECTED: 27 · SUPPRESSED: 83.

Filter to Status = SUPPRESSED, Action type = REQUEST_HUMAN_REVIEW, click Apply.

31 rows. Each is a proposal suppressed as a duplicate of an already-executed action.

6. Conflicting evidence (1 min)

Open http://localhost:3000/decisions?relationship=CONFLICT.

21 rows, filterable by scene, with correlation decision, match status, and confidence per row.

7. Predictions command (30 sec)

bash
npm run predictions
head -3 predictions.jsonl
150 lines, one per report, in file order.

If something breaks

"Dashboard data not found" — run npm run predictions and reload
Port 3000 busy — npm run dev -- -p 3001 and use that port
A command fails — run npm run freeze-check to see which check is red
Note

/incidents/incident-R113 is a report ID and returns 404. The incident is incident-R001.

