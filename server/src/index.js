/**
 * @fileoverview Matchday Copilot — Express API server.
 *
 * Handles persona-aware chat via the Google Gemini API with server-side
 * tool-calling, input sanitisation, rate limiting, and an LRU response
 * cache for efficiency. The server is the single source of truth for
 * which tools each persona can access — the model never sees a tool
 * outside its persona's allow-list.
 *
 * @module server/index
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { getPersona, listPersonas } from "./personas.js";
import { getDefinition, runTool } from "./tools/index.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { sanitizeChatBody } from "./middleware/sanitize.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** @type {number} Port the server listens on (overridable via env). */
const PORT = process.env.PORT || 3001;

/** @type {string} Gemini model identifier. */
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** @type {string} Allowed CORS origin for the client app. */
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

/**
 * Maximum number of Gemini tool-call round-trips before we give up.
 * Prevents infinite loops if the model keeps requesting tools.
 * @type {number}
 */
const MAX_TOOL_ROUNDS = 4;

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "[matchday-copilot] WARNING: GEMINI_API_KEY is not set. /api/chat will fail until it is."
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ---------------------------------------------------------------------------
// LRU Response Cache — avoids redundant Gemini API calls for identical queries
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CacheEntry
 * @property {string} reply     - The assistant's text reply.
 * @property {Array}  toolTrace - Array of tool calls made during the response.
 * @property {number} timestamp - When this entry was cached (Date.now()).
 */

const CACHE_MAX_SIZE = 128;
const CACHE_TTL_MS = 30_000; // 30-second TTL: crowd data stays fresh enough

/** @type {Map<string, CacheEntry>} LRU cache (Map preserves insertion order). */
const responseCache = new Map();

/**
 * Build a cache key from persona + the full message thread.
 * Uses a fast string hash to keep keys compact.
 * @param {string} personaId
 * @param {Array<{role: string, content: string}>} messages
 * @returns {string}
 */
function cacheKey(personaId, messages) {
  const raw = personaId + "|" + messages.map((m) => m.role + ":" + m.content).join("\n");
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(h >>> 0);
}

/**
 * Retrieve a cached response if it exists and hasn't expired.
 * Promotes the entry to "most recently used" on access.
 * @param {string} key
 * @returns {CacheEntry | null}
 */
function cacheGet(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  // Promote to most-recent (LRU refresh)
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry;
}

/**
 * Store a response in the cache, evicting the oldest entry if full.
 * @param {string} key
 * @param {string} reply
 * @param {Array} toolTrace
 */
function cacheSet(key, reply, toolTrace) {
  if (responseCache.size >= CACHE_MAX_SIZE) {
    // Evict the least-recently-used entry (first key in Map)
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { reply, toolTrace, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Pre-computed tool declarations per persona (avoids re-mapping per request)
// ---------------------------------------------------------------------------

/**
 * Convert an Anthropic-style input_schema tool definition to a Gemini
 * FunctionDeclaration. Gemini wraps the JSON Schema under `parameters`.
 * @param {Object} def - Tool definition with name, description, input_schema.
 * @returns {Object|null} Gemini FunctionDeclaration or null.
 */
function toGeminiFunctionDeclaration(def) {
  if (!def) return null;
  const schema = def.input_schema || { type: "object", properties: {} };
  return {
    name: def.name,
    description: def.description,
    parameters: schema,
  };
}

/** @type {Map<string, {declarations: Array, allowedNames: Set<string>}>} */
const personaToolCache = new Map();

/**
 * Get or compute Gemini tool declarations for a persona.
 * Cached on first access since persona configs are static.
 * @param {Object} persona - Persona config from personas.js.
 * @returns {{declarations: Array, allowedNames: Set<string>}}
 */
function getPersonaTools(persona) {
  const id = persona.label;
  if (personaToolCache.has(id)) return personaToolCache.get(id);

  const declarations = persona.tools
    .map(getDefinition)
    .filter(Boolean)
    .map(toGeminiFunctionDeclaration)
    .filter(Boolean);

  const allowedNames = new Set(persona.tools);
  const result = { declarations, allowedNames };
  personaToolCache.set(id, result);
  return result;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(helmet());

const allowedOrigins = new Set([
  CLIENT_ORIGIN,
  "http://localhost:5173",
  "http://localhost:3000",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || (origin && origin.endsWith(".vercel.app"))) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(rateLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health check endpoint for monitoring and deployment verification. */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: MODEL, cache: responseCache.size });
});

/** List all personas with their labels, taglines, and IDs. */
app.get("/api/personas", (_req, res) => {
  res.json({ personas: listPersonas() });
});

/**
 * Convert client message history (role: "user"/"assistant", content: string)
 * to the Gemini history format (role: "user"/"model", parts: [{text}]).
 * The LAST user message is NOT included — it is sent separately via sendMessage().
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Array<{role: string, parts: Array}>}
 */
function toGeminiHistory(messages) {
  const history = messages.slice(0, -1);
  return history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

/**
 * Main chat endpoint — accepts a persona id and message history,
 * runs the Gemini tool-calling loop, and returns the final response
 * with a full tool trace for transparency.
 */
app.post("/api/chat", sanitizeChatBody, async (req, res) => {
  const { persona: personaId, messages } = req.body;
  const persona = getPersona(personaId);

  if (!persona) {
    return res.status(400).json({ error: `Unknown persona "${personaId}".` });
  }

  // Check LRU cache first — fast path for repeated/identical queries
  const key = cacheKey(personaId, messages);
  const cached = cacheGet(key);
  if (cached) {
    return res.json({ reply: cached.reply, toolTrace: cached.toolTrace, cached: true });
  }

  // Get pre-computed tool declarations for this persona
  const { declarations, allowedNames } = getPersonaTools(persona);

  const tools = declarations.length
    ? [{ functionDeclarations: declarations }]
    : undefined;

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: persona.systemPrompt,
    tools,
  });

  const history = toGeminiHistory(messages);
  const chat = model.startChat({ history });
  const lastUserMessage = messages[messages.length - 1]?.content || "";
  const toolTrace = [];

  try {
    let result = await chat.sendMessage(lastUserMessage);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = result.response;
      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const fnCallParts =
        candidate.content?.parts?.filter((p) => p.functionCall) || [];

      if (fnCallParts.length === 0) {
        const finalText = response.text();
        // Cache the successful response for future identical queries
        cacheSet(key, finalText, toolTrace);
        return res.json({ reply: finalText, toolTrace });
      }

      // Execute each function call — only those on this persona's allow-list
      const fnResponseParts = fnCallParts.map((part) => {
        const { name, args } = part.functionCall;
        const allowed = allowedNames.has(name);
        const toolResult = allowed
          ? runTool(name, args)
          : { error: `Tool "${name}" is not available for this persona.` };

        toolTrace.push({ tool: name, input: args, result: toolResult });

        return {
          functionResponse: {
            name,
            response: toolResult,
          },
        };
      });

      result = await chat.sendMessage(fnResponseParts);
    }

    return res.status(504).json({
      error:
        "The assistant took too many steps to answer. Please try rephrasing your question.",
      toolTrace,
    });
  } catch (err) {
    console.error("[matchday-copilot] /api/chat error:", err.message);
    return res.status(500).json({
      error: "The assistant is temporarily unavailable. Please try again.",
    });
  }
});

// Catch-all for unknown routes
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ---------------------------------------------------------------------------
// Start server (skipped on Vercel — the export default handles it)
// ---------------------------------------------------------------------------

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[matchday-copilot] server listening on http://localhost:${PORT}`);
  });
}

export default app;
