import {
  AssignmentOperationalState,
  deriveScheduledDepartureState,
  ScheduledDepartureOperationalState,
} from "./operational-state.functions";

describe("Operational State Derivation (Multi-bus Aggregate State)", () => {
  const testMatrix: Array<{
    description: string;
    input: AssignmentOperationalState[];
    expected: ScheduledDepartureOperationalState;
  }> = [
    {
      description: "0 assignments -> SCHEDULED",
      input: [],
      expected: "SCHEDULED",
    },
    {
      description: "[ASSIGNED] -> ASSIGNED",
      input: ["ASSIGNED"],
      expected: "ASSIGNED",
    },
    {
      description: "[COMPLETED] -> COMPLETED",
      input: ["COMPLETED"],
      expected: "COMPLETED",
    },
    {
      description: "[IN_PROGRESS] -> IN_PROGRESS",
      input: ["IN_PROGRESS"],
      expected: "IN_PROGRESS",
    },
    {
      description: "[ASSIGNED, ASSIGNED] -> ASSIGNED",
      input: ["ASSIGNED", "ASSIGNED"],
      expected: "ASSIGNED",
    },
    {
      description: "[COMPLETED, COMPLETED] -> COMPLETED",
      input: ["COMPLETED", "COMPLETED"],
      expected: "COMPLETED",
    },
    {
      description: "[IN_PROGRESS, ASSIGNED] -> IN_PROGRESS",
      input: ["IN_PROGRESS", "ASSIGNED"],
      expected: "IN_PROGRESS",
    },
    {
      description: "[IN_PROGRESS, COMPLETED] -> IN_PROGRESS",
      input: ["IN_PROGRESS", "COMPLETED"],
      expected: "IN_PROGRESS",
    },
    {
      description:
        "[ASSIGNED, COMPLETED] -> ASSIGNED (Bug regression: one bus finished, one pending)",
      input: ["ASSIGNED", "COMPLETED"],
      expected: "ASSIGNED",
    },
    {
      description: "[ASSIGNED, COMPLETED, COMPLETED] -> ASSIGNED",
      input: ["ASSIGNED", "COMPLETED", "COMPLETED"],
      expected: "ASSIGNED",
    },
    {
      description: "[IN_PROGRESS, ASSIGNED, COMPLETED] -> IN_PROGRESS",
      input: ["IN_PROGRESS", "ASSIGNED", "COMPLETED"],
      expected: "IN_PROGRESS",
    },
  ];

  testMatrix.forEach(({ description, input, expected }) => {
    it(description, () => {
      expect(deriveScheduledDepartureState(input)).toBe(expected);
    });
  });
});
