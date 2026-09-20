import type { ReplayAssertion, ReplayEvaluation, ReplayReportResult } from "./types";

export function assertion(
  rubricArea: ReplayAssertion["rubricArea"],
  requirement: string,
  passed: boolean,
  evidence: readonly string[],
): ReplayAssertion {
  return { rubricArea, requirement, passed, evidence };
}

export function evaluateReplay(evaluation: ReplayEvaluation): ReplayEvaluation {
  return {
    ...evaluation,
    passed: evaluation.assertions.every((item) => item.passed) && evaluation.errors.length === 0,
  };
}

export function hasDecision(trace: readonly ReplayReportResult[], decision: ReplayReportResult["correlation"]["decision"]): boolean {
  return trace.some((item) => item.correlation.decision === decision);
}