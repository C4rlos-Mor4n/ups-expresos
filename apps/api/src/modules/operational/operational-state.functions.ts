export type AssignmentOperationalState =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED";

export type ScheduledDepartureOperationalState =
  | "SCHEDULED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED";

/**
 * Derives the unified aggregate operational state of a ScheduledDeparture based on the states of its active assignments.
 *
 * Deterministic precedence:
 * A. 0 assignments -> 'SCHEDULED'
 * B. Any assignment is IN_PROGRESS -> 'IN_PROGRESS'
 * C. No IN_PROGRESS and any assignment is ASSIGNED (i.e. not yet completed) -> 'ASSIGNED'
 * D. All assignments are COMPLETED -> 'COMPLETED'
 */
export function deriveScheduledDepartureState(
  assignmentStates: readonly AssignmentOperationalState[],
): ScheduledDepartureOperationalState {
  if (assignmentStates.length === 0) {
    return "SCHEDULED";
  }
  if (assignmentStates.includes("IN_PROGRESS")) {
    return "IN_PROGRESS";
  }
  if (assignmentStates.includes("ASSIGNED")) {
    return "ASSIGNED";
  }
  if (assignmentStates.every((status) => status === "COMPLETED")) {
    return "COMPLETED";
  }
  return "ASSIGNED";
}
