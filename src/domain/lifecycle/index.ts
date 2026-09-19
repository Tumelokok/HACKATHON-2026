export {
  VALID_TRANSITIONS,
  createLifecycleState,
  ensureIncidentLifecycle,
  processLifecycleTransition,
  transitionIncident,
} from "./lifecycleEngine";
export type {
  AcceptedLifecycleTransition,
  IncidentState,
  LifecycleActor,
  LifecycleEvidence,
  LifecycleProcessingResult,
  LifecycleRecord,
  LifecycleState,
  LifecycleTransitionEntry,
  LifecycleTransitionIntent,
  LifecycleTransitionRequest,
  LifecycleTransitionResult,
  RejectedLifecycleTransition,
} from "./types";