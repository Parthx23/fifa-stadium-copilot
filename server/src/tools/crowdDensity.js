/**
 * @fileoverview Gate crowd density tool.
 * Returns the current crowd level and estimated wait time at a stadium entry gate.
 * Data is derived from the deterministic mock store (seeded hash).
 * @module tools/crowdDensity
 */
import { crowdLevelFor, GATES } from "../data/mockStore.js";

export const definition = {
  name: "get_gate_crowd_density",
  description:
    "Get the current crowd density and estimated wait time at a stadium entry gate. " +
    "Use this when someone asks how busy a gate is, which gate to use, or how long entry will take.",
  input_schema: {
    type: "object",
    properties: {
      gate: {
        type: "string",
        description: `Gate letter, one of: ${GATES.join(", ")}. If unsure, check all gates by calling once per gate.`,
      },
    },
    required: ["gate"],
  },
};

export function run({ gate }) {
  const normalized = String(gate || "").trim().toUpperCase();
  if (!GATES.includes(normalized)) {
    return { error: `Unknown gate "${gate}". Valid gates are: ${GATES.join(", ")}.` };
  }
  return crowdLevelFor(normalized);
}
