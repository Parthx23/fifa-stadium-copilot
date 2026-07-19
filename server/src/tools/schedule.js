import { MATCHES } from "../data/mockStore.js";

export const definition = {
  name: "get_match_schedule",
  description:
    "Look up upcoming match schedule at this venue, optionally filtered by team name or date. " +
    "Use for questions about kickoff time, which gates serve a match, or what's on today.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional team name or date (YYYY-MM-DD) to filter by. Leave empty to list everything.",
      },
    },
  },
};

export function run({ query } = {}) {
  if (!query) return { matches: MATCHES };
  const q = query.toLowerCase();
  const matches = MATCHES.filter(
    (m) => m.teams.toLowerCase().includes(q) || m.date === query
  );
  return { matches: matches.length ? matches : [], note: matches.length ? undefined : "No matches found for that query." };
}
