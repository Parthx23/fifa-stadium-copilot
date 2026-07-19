import { transportStatusFor } from "../data/mockStore.js";

export const definition = {
  name: "get_transport_status",
  description:
    "Get live status for a public transport or shuttle route serving the stadium " +
    "(train, bus, or official shuttle). Use when someone asks how to get to/from the venue " +
    "or whether their train/shuttle is delayed.",
  input_schema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["train", "bus", "shuttle"], description: "Transport mode." },
      route: { type: "string", description: "Route name or line, e.g. 'NJ Transit Meadowlands Rail' or 'Fan Shuttle Loop 2'." },
    },
    required: ["mode", "route"],
  },
};

export function run({ mode, route }) {
  return transportStatusFor(mode, route);
}
