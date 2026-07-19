/**
 * @fileoverview Incident log fetch tool.
 * Returns the list of all logged operational incidents, optionally filtered by severity.
 * @module tools/incidentLog
 */
import { INCIDENT_LOG } from "../data/mockStore.js";

export const definition = {
  name: "get_incident_log",
  description:
    "Retrieve the active log of operational incidents at the stadium. " +
    "Use this when organizers or staff ask what incidents are currently active, " +
    "what problems have been logged, or to get a venue-wide safety and operational status.",
  input_schema: {
    type: "object",
    properties: {
      severity: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Optional filter to restrict results by severity level.",
      },
    },
  },
};

export function run({ severity } = {}) {
  if (severity) {
    const s = String(severity).toLowerCase().trim();
    const filtered = INCIDENT_LOG.filter((inc) => inc.severity === s);
    return {
      incidents: filtered,
      count: filtered.length,
      note: filtered.length ? undefined : `No active incidents with severity "${severity}".`,
    };
  }
  return {
    incidents: INCIDENT_LOG,
    count: INCIDENT_LOG.length,
  };
}
