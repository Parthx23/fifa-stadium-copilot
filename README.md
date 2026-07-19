# Matchday Copilot — GenAI Stadium-Ops Assistant for FIFA World Cup 2026™

> **Live deployment:** [matchday-copilot.vercel.app](https://fifa-stadium-copilot.vercel.app)

A single GenAI chat assistant that adapts its knowledge, tone, and available
real-time tools to **four stadium personas**: Fan, Volunteer, Organizer, and
Venue Staff. One codebase, one model, four working modes — because on matchday
the same stadium looks completely different depending on who is asking.

---

## 1. Chosen vertical

All four provided personas, unified behind one adaptive role switcher rather
than four separate apps:

| Persona | Core need on matchday | Tools exposed |
|---|---|---|
| **Fan** | "How do I get in, get around, and get home?" | wayfinding, transport status, match schedule, gate crowd levels, lost & found, weather advisory |
| **Volunteer** | "Where do I send this person / this problem?" | wayfinding, gate crowd levels, incident reporting, match schedule, accessible amenities |
| **Organizer** | "What's happening across the venue right now?" | gate crowd levels, transport status, incident log, weather advisory, match schedule |
| **Venue Staff** | "Is this area safe, accessible, and staffed?" | accessible amenities, gate crowd levels, incident reporting, wayfinding |

Each persona gets its own system prompt (tone, priorities, escalation rules)
and its own **allow-list of tools** — a volunteer can log an incident, a fan
cannot; an organizer sees venue-wide crowd data, a fan only sees the gate they
ask about. **This is enforced server-side, not just prompted.**

---

## 2. Approach and logic

### Why tool-calling over RAG

Stadium data (crowd levels, transport, incidents) is **operational and changes
minute-to-minute**, so it belongs behind live function calls, not a static
knowledge base. The model decides *which* tool(s) a question needs, calls them,
and reasons over the results to give a grounded, current answer instead of
guessing from stale context.

### Server-side tool allow-listing per persona

The client sends a `persona` id; the server looks up that persona's system
prompt and tool subset and is the **only thing** that ever calls the LLM API
or the underlying data functions. The model cannot be prompted into using a
tool outside its persona's allow-list, because those tool definitions are
**never sent to the API** for that request.

### Deterministic mock data layer

No real stadium feeds exist for a hackathon demo, so `server/src/data/mockStore.js`
generates realistic, *reproducible* operational data (crowd levels, transport
delays, weather) from a **seeded FNV-1a hash** instead of `Math.random()`.
This keeps the tools testable and the demo believable — Gate C is always busier
than Gate A, not a coin flip.

### Response caching & efficiency

Server-side **LRU response cache** eliminates redundant Gemini API calls for
identical (persona, message) pairs. Cache entries auto-expire after 30 seconds
to balance freshness with latency — a crowd-level answer from 10 seconds ago
is still accurate, but one from 5 minutes ago is not. Cache-hit responses
return in under 2ms vs. 1–3 seconds for a live API call.

### Multilingual assistance

Gemini already reasons and writes fluently across languages, so the system
prompt instructs it to **reply in the language the fan writes in** — no
separate translation service or extra latency. A Spanish-speaking fan in
New Jersey gets an answer in Spanish, automatically.

---

## 3. Architecture

```
Browser (React + Vite)          Express server (Node.js)        Google Gemini API
┌─────────────────┐   POST     ┌────────────────────────┐       ┌──────────────┐
│ Persona rail     │  /api/chat │ 1. sanitize + validate │       │  Gemini 2.5  │
│ Chat window      │───────────▶│ 2. check LRU cache     │       │  Flash       │
│ Live-data cards  │◀───────────│ 3. load persona prompt │──────▶│  (tool-call) │
│ Starter prompts  │   reply +  │    + tool allow-list   │◀──────│              │
└─────────────────┘  tool trace │ 4. run tool loop       │       └──────────────┘
                                │ 5. call mock data fns  │
                                │ 6. cache response      │
                                └────────────────────────┘
```

1. User picks a role on the persona rail (can also be pre-set for kiosk deployment).
2. Client sends message history + persona id to `POST /api/chat`.
3. Server checks the LRU cache — on hit, returns instantly.
4. On miss, attaches the persona's system prompt + tool definitions and calls Gemini.
5. If Gemini requests a tool (e.g. `get_gate_crowd_density`), the server runs
   the matching function against the mock data layer, returns the result,
   and loops (up to 4 rounds) until Gemini has a final text answer.
6. Client renders the answer plus a "live data" trace card for every tool call,
   so the user can see *what was actually looked up*, not just trust a black box.

---

## 4. Assumptions

- Real crowd/transport/schedule feeds are out of scope for a hackathon
  submission; `mockStore.js` is a clearly-labelled stand-in with the same
  shape a real feed would have, so swapping it for a real API later means
  changing one file, not the assistant logic.
- One shared Gemini API key per deployment (server-side only, never
  exposed to the browser) is acceptable for a tournament-operated kiosk/app.
- "Public repository, single branch, <10 MB" rules mean no `node_modules`,
  lockfile bloat, or binary assets are committed — see `.gitignore`.

---

## 5. Project layout

```
├── api/              Vercel serverless entry point
├── client/           React + Vite chat UI
│   ├── src/
│   │   ├── components/    ChatWindow, PersonaSelector, MessageBubble, ToolCallCard, Ticker
│   │   ├── data/          Client-side persona metadata & starter prompts
│   │   ├── api.js         API client (fetch wrapper with error handling)
│   │   ├── App.jsx        Root component with persona state management
│   │   └── styles.css     Design system: stadium/scoreboard themed tokens
│   └── index.html
├── server/           Express API server
│   ├── src/
│   │   ├── __tests__/     Vitest unit tests (tools + personas)
│   │   ├── data/          Deterministic seeded mock data layer (mockStore.js)
│   │   ├── middleware/    Rate limiter (sliding window) + input sanitizer
│   │   ├── tools/         8 tool implementations with Gemini FunctionDeclarations
│   │   ├── personas.js    4 persona configs: system prompts + tool allow-lists
│   │   └── index.js       Express app with Gemini chat + tool-calling loop + LRU cache
│   └── package.json
├── .env.example       Environment variable template
├── vercel.json        Vercel routing configuration
└── README.md          This file
```

---

## 6. Running locally

```bash
# 1. Server
cd server
cp ../.env.example .env   # add your GEMINI_API_KEY
npm install
npm test                  # runs the tool + persona unit tests
npm run dev               # http://localhost:3001

# 2. Client (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

The client proxies `/api/*` to `http://localhost:3001` in dev (see `client/vite.config.js`).

---

## 7. Security design

| Layer | Mechanism | Why |
|---|---|---|
| **API key isolation** | `GEMINI_API_KEY` is read only on the server via `process.env`, never sent to or readable by the client | Prevents key leakage even if client JS is inspected |
| **Rate limiting** | Per-IP sliding window (20 req/min) via `middleware/rateLimiter.js` | Prevents abuse and runaway API costs |
| **Input sanitization** | Control character stripping + 2 KB length cap + history truncation (40 msgs) via `middleware/sanitize.js` | Blocks null-byte injection, payload flooding |
| **CORS restriction** | Origin allowlist (not `*`), dynamically supporting `*.vercel.app` deployment domains | Prevents unauthorized cross-origin API calls |
| **Persona tool enforcement** | Server-side allow-list — tool definitions not even sent to Gemini outside a persona's scope | A compromised client cannot access `report_incident` from the Fan persona |
| **Helmet.js** | Default security headers (CSP, HSTS, X-Frame-Options, etc.) | Defence-in-depth against common web vulnerabilities |

---

## 8. Accessibility design

- **Keyboard navigation**: All interactive controls (persona tabs, send button,
  chat input, starter prompts) are fully keyboard-reachable and carry `aria-label` attributes.
- **Screen reader support**: Chat bubbles use `role="status"` for assistant messages;
  persona tabs use `aria-pressed`; tool cards use descriptive `aria-label` attributes.
- **Non-colour indicators**: Crowd-level and transport-delay status is never
  communicated by colour alone — each state has a text label alongside the dot indicator.
- **Reduced motion**: Respects `prefers-reduced-motion` for the ticker animation
  (falls back to static text).
- **Typography**: Minimum 16px body text, 4.5:1+ WCAG AA contrast ratio in
  both the stadium theme and default light background.
- **Semantic HTML**: `<nav>`, `<section>`, `<form>`, `<label>` used
  throughout; hidden labels for screen readers where visual labels are omitted.

---

## 9. Efficiency optimizations

- **LRU response cache**: Identical (persona + message hash) lookups return
  cached Gemini responses within 2ms, with a 30-second TTL to balance freshness.
- **Tool allow-list pre-computation**: Tool declarations are computed once per
  persona and reused across requests — no re-mapping on every API call.
- **Deterministic mock data**: FNV-1a seeded hash produces O(1) lookups with
  no I/O, no database, no network latency for mock data functions.
- **History truncation**: Client history is capped at 40 messages server-side
  before sending to Gemini, preventing token-limit overflows and reducing latency.
- **Minimal bundle**: Client React bundle is < 50 KB gzipped; Google Fonts
  loaded with `preconnect` + `display=swap` for non-blocking rendering.
- **Vercel edge deployment**: Serverless function collocated with CDN-served
  static assets — zero cold-start overhead for the frontend.

---

## 10. Testing

`server/src/__tests__` covers:
- **Tool registry integrity**: Every registered tool has a matching definition and run function.
- **Deterministic output**: Same input → same output across runs (via seeded hash).
- **Edge cases**: Unknown gates, unknown tools, empty queries, case normalization.
- **Persona security**: Fan cannot reach `report_incident`; every tool is
  reachable by at least one persona; `getPersona` returns null for unknown ids.
- **Incident uniqueness**: Each `report_incident` call generates a unique ID.
- **Accessible routing**: `get_wayfinding` returns step-free routes when `accessible=true`.

Run with `npm test` inside `server/`.

---

## 11. Future enhancements (out of scope for hackathon)

- **Real-time data feeds**: Replace `mockStore.js` with live crowd-sensor,
  transport API (NJ Transit), and weather API (OpenWeatherMap) integrations.
- **Streaming responses**: Replace request-response with SSE/WebSocket for
  real-time assistant output.
- **Multi-venue support**: Parameterize `VENUE` to support all 16 World Cup
  2026 stadiums across the US, Mexico, and Canada.
- **Persistent incident log**: Store incidents in a database (e.g. Supabase)
  instead of in-memory array for cross-session persistence.
- **Authentication**: Per-user/role authentication for staff-facing personas
  using tournament credential systems.
