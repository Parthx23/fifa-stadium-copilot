import express from "express";
import cors from "cors";
import helmet from "helmet";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { getPersona, listPersonas } from "./personas.js";
import { getDefinition, runTool } from "./tools/index.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { sanitizeChatBody } from "./middleware/sanitize.js";

const PORT = process.env.PORT || 3001;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const MAX_TOOL_ROUNDS = 4;

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "[matchday-copilot] WARNING: GEMINI_API_KEY is not set. /api/chat will fail until it is."
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const app = express();
app.use(helmet());
const allowedOrigins = new Set([CLIENT_ORIGIN, "http://localhost:5173", "http://localhost:3000"]);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || origin.endsWith(".vercel.app")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(rateLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: MODEL });
});

app.get("/api/personas", (_req, res) => {
  res.json({ personas: listPersonas() });
});

// Convert an Anthropic-style input_schema tool definition to a Gemini
// FunctionDeclaration. Gemini wraps the JSON Schema under `parameters`
// and uses the tool name + description directly.
function toGeminiFunctionDeclaration(def) {
  if (!def) return null;
  const schema = def.input_schema || { type: "object", properties: {} };
  return {
    name: def.name,
    description: def.description,
    parameters: schema,
  };
}

// Convert client message history (role: "user"/"assistant", content: string)
// to the Gemini history format (role: "user"/"model", parts: [{text}]).
// The LAST user message is NOT included — it is passed separately to sendMessage().
function toGeminiHistory(messages) {
  // Drop the final user turn; it will be sent via chat.sendMessage()
  const history = messages.slice(0, -1);
  return history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

app.post("/api/chat", sanitizeChatBody, async (req, res) => {
  const { persona: personaId, messages } = req.body;
  const persona = getPersona(personaId);

  if (!persona) {
    return res.status(400).json({ error: `Unknown persona "${personaId}".` });
  }

  // Build Gemini tool declarations from this persona's allow-list only.
  const allowedNames = new Set(persona.tools);
  const functionDeclarations = persona.tools
    .map(getDefinition)
    .filter(Boolean)
    .map(toGeminiFunctionDeclaration)
    .filter(Boolean);

  const tools = functionDeclarations.length
    ? [{ functionDeclarations }]
    : undefined;

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: persona.systemPrompt,
    tools,
  });

  // Gemini uses a chat session with incremental history.
  const history = toGeminiHistory(messages);
  const chat = model.startChat({ history });

  // The user's latest message is the last entry in messages.
  const lastUserMessage = messages[messages.length - 1]?.content || "";

  const toolTrace = [];

  try {
    let result = await chat.sendMessage(lastUserMessage);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = result.response;
      const candidate = response.candidates?.[0];
      if (!candidate) break;

      // Check for function call parts in the response.
      const fnCallParts = candidate.content?.parts?.filter(
        (p) => p.functionCall
      ) || [];

      if (fnCallParts.length === 0) {
        // No more tool calls — extract the final text answer.
        const finalText = response.text();
        return res.json({ reply: finalText, toolTrace });
      }

      // Execute each function call (only those on the persona's allow-list).
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

      // Send the tool results back to Gemini and get the next response.
      result = await chat.sendMessage(fnResponseParts);
    }

    // Hit the round limit without a text-only response.
    return res.status(504).json({
      error:
        "The assistant took too many steps to answer. Please try rephrasing your question.",
      toolTrace,
    });
  } catch (err) {
    console.error("[matchday-copilot] /api/chat error:", err.message);
    return res
      .status(500)
      .json({ error: "The assistant is temporarily unavailable. Please try again." });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[matchday-copilot] server listening on http://localhost:${PORT}`);
  });
}

export default app;
