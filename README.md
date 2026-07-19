# Matchday Copilot — a GenAI stadium-ops assistant for FIFA World Cup 2026

A single chat assistant that adapts its knowledge, tone, and available real-time
tools to **four stadium personas**: Fan, Volunteer, Organizer, and Venue Staff.
One codebase, one model, four working modes — because on matchday the same
stadium looks completely different depending on who is asking.

## 1. Chosen vertical

All four provided personas, unified behind one role switcher rather than four
separate apps:

| Persona | Core need on matchday | Tools exposed |
|---|---|---|
| **Fan** | "How do I get in, get around, and get home?" | wayfinding, transport status, match schedule, gate crowd levels, lost & found, weather advisory |
| **Volunteer** | "Where do I send this person / this problem?" | wayfinding, gate crowd levels, incident reporting, match schedule, accessible amenities |
| **Organizer** | "What's happening across the venue right now?" | gate crowd levels, transport status, incident log, weather advisory, match schedule |
| **Venue Staff** | "Is this area safe, accessible, and staffed?" | accessible amenities, gate crowd levels, incident reporting, wayfinding |

Each persona gets its own system prompt (tone, priorities, escalation rules)
and its own **allow-list of tools** — a volunteer can log an incident, a fan
cannot; an organizer sees venue-wide crowd data, a fan only sees the gate they
ask about. This is enforced server-side, not just prompted.

## 2. Approach and logic

- **LLM + tool-calling, not RAG.** Stadium data (crowd levels, transport,
  incidents) is operational and changes minute-to-minute, so it belongs behind
  live function calls, not a static knowledge base. The model decides *which*
  tool(s) a question needs, calls them, and reasons over the results to give a
  grounded, current answer instead of guessing.
- **Server-side tool allow-listing per persona.** The client sends a
  `persona` id; the server looks up that persona's system prompt and tool
  subset and is the only thing that ever calls `ANTHROPIC_API_KEY` or the
  underlying data functions. The model cannot be prompted into using a tool
  outside its persona's allow-list, because those tool definitions are never
  sent to the API for that request.
- **Deterministic mock data layer.** No real stadium feeds exist for a demo,
  so `server/src/data/mockStore.js` generates realistic, *reproducible*
  operational data (crowd levels, transport delays, weather) from a seeded
  hash instead of `Math.random()`. This keeps the tools testable and the
  demo believable — Gate C is always busier than Gate A, not a coin flip.
- **Multilingual assistance is intrinsic, not a tool.** Claude already
  reasons and writes fluently across languages, so the system prompt simply
  instructs it to reply in the language the fan writes in — no separate
  translation service or extra latency.

## 3. How the solution works

```
Browser (React)                Express server                 Anthropic API
┌───────────────┐   POST      ┌──────────────────┐   messages   ┌──────────┐
│ Persona rail   │  /api/chat  │ 1. sanitize input│  + tools    │  Claude   │
│ Chat window    │────────────▶│ 2. load persona  │────────────▶│ Sonnet 5 │
│ Live-data cards│◀────────────│    prompt+tools  │◀────────────│           │
└───────────────┘   reply +   │ 3. run tool loop │  tool_use    └──────────┘
                    tool trace │ 4. call mock data │
                                │    functions      │
                                └──────────────────┘
```

1. The person picks a role on the persona rail (this can also be set once by
   whoever hands out the device — e.g. all volunteer tablets pre-select
   Volunteer).
2. The client sends the running message history + persona id to
   `POST /api/chat`.
3. The server attaches only that persona's system prompt and tool
   definitions and calls the Anthropic Messages API.
4. If Claude requests a tool (e.g. `get_gate_crowd_density`), the server runs
   the matching function against the mock data layer, returns the
   `tool_result`, and loops (up to 4 rounds) until Claude has a final answer.
5. The client renders the answer plus a "live data" trace card for every
   tool call, so the person can see *what was actually looked up*, not just
   trust a black box.

## 4. Assumptions

- Real crowd/transport/schedule feeds are out of scope for a hackathon
  submission; `mockStore.js` is a clearly-labelled stand-in with the same
  shape a real feed would have, so swapping it for a real API later means
  changing one file, not the assistant logic.
- One shared Anthropic API key per deployment (server-side only, never
  exposed to the browser) is acceptable for a tournament-operated kiosk/app,
  rather than per-user keys.
- "Public repository, single branch, <10 MB" rules mean no `node_modules`,
  lockfile bloat, or binary assets are committed — see `.gitignore`.

## 5. Project layout

```
server/   Express API: persona prompts, tool implementations, mock data, tests
client/   React + Vite chat UI: persona rail, chat window, live-data cards
```

## 6. Running it locally

```bash
# 1. Server
cd server
cp ../.env.example .env   # add your ANTHROPIC_API_KEY
npm install
npm test                  # runs the tool + persona unit tests
npm run dev                # http://localhost:3001

# 2. Client (new terminal)
cd client
npm install
npm run dev                # http://localhost:5173
```

The client proxies `/api/*` to `http://localhost:3001` in dev (see
`client/vite.config.js`).

## 7. Security notes

- `ANTHROPIC_API_KEY` is read only on the server via `process.env` and never
  sent to or readable by the client.
- Every request is rate-limited per IP (`server/src/middleware/rateLimiter.js`)
  and input is length-capped and stripped of control characters
  (`server/src/middleware/sanitize.js`) before it reaches the model.
- CORS is restricted to `CLIENT_ORIGIN` from the environment, not `*`.
- The tool allow-list is enforced server-side per persona, so a compromised
  or manipulated client cannot get access to another persona's tools (e.g.
  incident reporting) just by editing request JSON — the server re-validates
  `persona` against its own map.

## 8. Accessibility notes

- All interactive controls (persona tabs, send button, chat input) are
  keyboard-reachable and carry `aria-label`s.
- Colour is never the only signal for crowd-level or incident severity —
  each state also has a text label and an icon glyph.
- Respects `prefers-reduced-motion` for the ticker and tool-call flip
  animation.
- Chat text uses a minimum 16px body size and a 4.5:1+ contrast ratio
  against the background in both the light stadium theme and the default
  theme.

## 9. Testing

`server/src/__tests__` covers:
- Each tool function returns the expected shape and is deterministic for a
  given input (via the seeded mock data layer).
- Persona → tool allow-list mapping (no persona can see another persona's
  tools; every tool is reachable by at least one persona).

Run with `npm test` inside `server/`.
