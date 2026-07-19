/**
 * @fileoverview Lost & found search tool.
 * Searches the logged lost & found inventory by partial item description.
 * @module tools/lostFound
 */
import { LOST_FOUND_LOG } from "../data/mockStore.js";

export const definition = {
  name: "search_lost_found",
  description: "Search logged lost & found items by description, or note that nothing matched.",
  input_schema: {
    type: "object",
    properties: {
      itemDescription: { type: "string", description: "What the item is, e.g. 'blue jacket' or 'water bottle'." },
    },
    required: ["itemDescription"],
  },
};

export function run({ itemDescription }) {
  const q = String(itemDescription || "").toLowerCase();
  const matches = LOST_FOUND_LOG.filter((entry) => entry.item.toLowerCase().includes(q) || q.includes(entry.item.split(" ").pop()));
  return {
    query: itemDescription,
    matches,
    guidance: matches.length
      ? "Direct the fan to Guest Services with the matching entry's location."
      : "Nothing matched yet — advise reporting it at any Guest Services desk so it can be logged.",
  };
}
