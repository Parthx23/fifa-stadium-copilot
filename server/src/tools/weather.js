/**
 * @fileoverview Weather advisory tool.
 * Returns current weather conditions and any heat/wind/rain advisory for the venue.
 * @module tools/weather
 */
import { weatherFor, VENUE } from "../data/mockStore.js";

export const definition = {
  name: "get_weather_advisory",
  description: "Get current weather conditions and any heat/wind/rain advisory for the venue.",
  input_schema: {
    type: "object",
    properties: {
      venue: { type: "string", description: `Venue name, defaults to "${VENUE.name}" if omitted.` },
    },
  },
};

export function run({ venue } = {}) {
  return weatherFor(venue || VENUE.name);
}
