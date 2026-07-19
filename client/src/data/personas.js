// Mirrors server/src/personas.js ids and labels. Kept as plain display
// metadata on the client — the server remains the source of truth for
// system prompts and tool allow-lists.
export const PERSONAS = [
  {
    id: "fan",
    label: "Fan",
    tagline: "Getting in & around",
    starterPrompts: [
      "How busy is Gate C right now?",
      "Get me from the North parking lot to Section 118",
      "When is Argentina vs Brazil and which gates serve it?",
    ],
  },
  {
    id: "volunteer",
    label: "Volunteer",
    tagline: "Directing & flagging issues",
    starterPrompts: [
      "A fan near Gate B says someone fainted — what do I do?",
      "Where's the nearest accessible restroom to Gate D?",
      "Which gate should I redirect fans to if Gate A is packed?",
    ],
  },
  {
    id: "organizer",
    label: "Organizer",
    tagline: "Venue-wide picture",
    starterPrompts: [
      "Give me a quick status check across all gates",
      "Any weather advisories I should know about today?",
      "What incidents have been logged so far?",
    ],
  },
  {
    id: "venue_staff",
    label: "Venue Staff",
    tagline: "Accessibility & safety",
    starterPrompts: [
      "Check accessible amenities near Gate D",
      "Log a facility issue: elevator stuck near Section 112",
      "Is Section 128 crowded right now?",
    ],
  },
];
