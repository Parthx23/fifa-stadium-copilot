/**
 * @fileoverview Wayfinding tool.
 * Provides step-by-step directions between two points inside or around the stadium,
 * with automatic support for accessible / step-free routes.
 * @module tools/wayfinding
 */
export const definition = {
  name: "get_wayfinding",
  description:
    "Get step-by-step directions between two points inside or around the stadium " +
    "(e.g. from a gate to a seat section, from a concourse to a restroom, from parking to a gate). " +
    "Always set accessible to true if the person mentions a wheelchair, mobility aid, stroller, or asks for step-free routes.",
  input_schema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Starting point, e.g. 'Gate C' or 'North parking lot'." },
      to: { type: "string", description: "Destination, e.g. 'Section 112' or 'nearest accessible restroom'." },
      accessible: { type: "boolean", description: "True if a step-free / wheelchair-accessible route is required." },
    },
    required: ["from", "to"],
  },
};

const STEP_LIBRARY = [
  "Head toward the main concourse and follow the overhead signage",
  "Take the ramp/elevator up one level",
  "Turn at the numbered section marker matching your destination",
  "Follow the colour-coded floor line to your section",
  "Staff in tournament vests can point you the last stretch",
];

export function run({ from, to, accessible }) {
  const steps = accessible
    ? [
        "Use the accessible entrance and elevator, not the escalator",
        "Follow the blue accessible-route floor markings",
        "Accessible seating and restrooms are sign-posted with the wheelchair icon",
        `Arrive at ${to}`,
      ]
    : [...STEP_LIBRARY.slice(0, 3), `Arrive at ${to}`];

  const distanceMeters = 120 + (String(from + to).length % 5) * 60;
  return {
    from,
    to,
    accessibleRoute: Boolean(accessible),
    distanceMeters,
    etaMinutes: Math.max(2, Math.round(distanceMeters / 70)),
    steps,
  };
}
