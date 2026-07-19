/**
 * @fileoverview Incident reporting tool.
 * Logs operational incidents (medical, crowding, lost child, facility, safety)
 * and returns a unique incident ID with estimated response time.
 * @module tools/incidents
 */
import { INCIDENT_LOG, nextIncidentId } from "../data/mockStore.js";

export const definition = {
  name: "report_incident",
  description:
    "Log an operational incident (medical, crowding, lost child, facility issue, safety concern) " +
    "so organizers/venue staff can respond. Use whenever a volunteer or staff member describes " +
    "something that needs a response, not just an information request.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["medical", "crowding", "lost-child", "facility", "safety", "other"],
        description: "Category of incident.",
      },
      location: { type: "string", description: "Where the incident is, e.g. 'Section 108 concourse'." },
      severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
      description: { type: "string", description: "Short free-text description of what's happening." },
    },
    required: ["type", "location", "severity"],
  },
};

const ETA_BY_SEVERITY = { low: "20 min", medium: "10 min", high: "5 min", critical: "immediate dispatch" };

export function run({ type, location, severity, description }) {
  const incidentId = nextIncidentId();
  const record = {
    incidentId,
    type,
    location,
    severity,
    description: description || "",
    status: "logged",
    responseEta: ETA_BY_SEVERITY[severity] || "10 min",
    loggedAt: new Date().toISOString(),
  };
  INCIDENT_LOG.push(record);
  return record;
}
