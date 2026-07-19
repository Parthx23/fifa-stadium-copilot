import { accessibleAmenitiesFor } from "../data/mockStore.js";

export const definition = {
  name: "get_accessible_amenities",
  description:
    "Check accessible amenities near a location: accessible restrooms, elevator status, " +
    "accessible seating availability, and sensory/quiet rooms. Use for any accessibility question.",
  input_schema: {
    type: "object",
    properties: {
      location: { type: "string", description: "Concourse, gate, or section, e.g. 'Gate D concourse' or 'Section 128'." },
    },
    required: ["location"],
  },
};

export function run({ location }) {
  return accessibleAmenitiesFor(location);
}
