import * as crowdDensity from "./crowdDensity.js";
import * as wayfinding from "./wayfinding.js";
import * as transport from "./transport.js";
import * as schedule from "./schedule.js";
import * as incidents from "./incidents.js";
import * as lostFound from "./lostFound.js";
import * as weather from "./weather.js";
import * as accessibility from "./accessibility.js";

// Every tool the assistant *could* know about. Persona allow-lists in
// personas.js decide which of these are actually sent to the model per
// request — this registry is just the full catalogue + how to execute each.
export const TOOL_MODULES = {
  get_gate_crowd_density: crowdDensity,
  get_wayfinding: wayfinding,
  get_transport_status: transport,
  get_match_schedule: schedule,
  report_incident: incidents,
  search_lost_found: lostFound,
  get_weather_advisory: weather,
  get_accessible_amenities: accessibility,
};

export function getDefinition(name) {
  return TOOL_MODULES[name]?.definition;
}

export function runTool(name, input) {
  const mod = TOOL_MODULES[name];
  if (!mod) return { error: `Unknown tool "${name}".` };
  try {
    return mod.run(input || {});
  } catch (err) {
    return { error: `Tool "${name}" failed: ${err.message}` };
  }
}
