# Campus Crisis Agent — Severity Specification

## 1. Purpose

The severity engine determines the current risk level of an incident from available evidence.

Severity must be explainable, reproducible and reassessable.

The language model must not have unrestricted authority to assign severity.

---

# 2. Severity Levels

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

# 3. Severity Model

Severity is calculated from structured evidence.

The engine considers:

```text
Reported Severity
Category
Description Indicators
Affected People
Immediate Danger Indicators
Operational Impact
Escalation Evidence
Conflict Evidence
Resolution/Control Evidence
```

---

# 4. Evidence Indicators

Examples of high-risk indicators include:

```text
fire
smoke
electrical danger
trapped
injury
immediate threat
evacuation
multiple people affected
security threat
critical infrastructure failure
```

Examples of control/resolution indicators include:

```text
restored
released
repaired
controlled
resolved
safe
incident closed
```

---

# 5. Severity Assessment

Each assessment produces:

```text
level
confidence
reason
evidenceReportIds
source
```

Example:

```text
{
  level: "HIGH",
  confidence: 0.89,
  reason: "Smoke reported in an occupied campus building with evacuation activity.",
  evidenceReportIds: ["R001", "R003"],
  source: "RULE_ENGINE"
}
```

---

# 6. Evidence Precedence

When multiple reports provide severity information:

1. Preserve all reported severities.
2. Evaluate the evidence collectively.
3. Prefer stronger contextual evidence over a bare severity label.
4. Detect contradictions.
5. Recalculate the incident severity.

A later report must not automatically erase the earlier assessment.

---

# 7. Confidence

Confidence represents the strength and consistency of available evidence.

Confidence should increase when:

- multiple reports agree
- operational personnel provide supporting evidence
- location and category are consistent
- descriptions contain clear risk indicators
- the incident behaviour confirms the assessment

Confidence should decrease when:

- reports contradict one another
- important information is missing
- the category is ambiguous
- evidence is weak

---

# 8. Safety Ceiling

Certain evidence can impose a minimum severity floor.

For example, an incident containing credible immediate-danger evidence must not be reduced to LOW merely because a later report contains a low reported severity value.

The engine must evaluate the complete evidence set.

---

# 9. Severity Reassessment

Severity must be recalculated whenever materially relevant evidence arrives.

Example:

```text
LOW
 ↓
new danger evidence
 ↓
HIGH
 ↓
control evidence
 ↓
MONITORING
```

Every change must be recorded.

---

# 10. Conflict Handling

Conflicting severity reports create evidence of uncertainty.

Example:

```text
Report A → HIGH
Report B → LOW
```

The system should:

- preserve both
- create a conflict
- calculate the current evidence-based assessment
- reduce confidence where appropriate
- request human review if the conflict is materially safety-relevant

---

# 11. Resolution Handling

Resolution evidence may reduce active response requirements.

However, resolution evidence must not simply erase the historical severity.

Example:

```text
HIGH
 ↓
incident controlled
 ↓
MONITORING
 ↓
RESOLVED
```

Historical HIGH severity remains in the record.

---

# 12. Tests

Required tests:

- LOW incident
- MEDIUM incident
- HIGH incident
- CRITICAL incident
- severity escalation
- severity reduction after credible control
- conflicting severity
- missing severity
- malformed severity
- multiple corroborating reports
- resolution evidence
- severity history preservation

---

# 13. Success Criteria

The severity engine is complete when:

- severity is deterministic/reproducible for the same evidence
- severity is explainable
- severity can change as evidence changes
- historical assessments are preserved
- conflicts affect confidence
- dangerous evidence cannot be silently overridden
- resolution evidence is represented correctly