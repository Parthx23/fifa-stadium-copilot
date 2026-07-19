const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 40;

// Strip control characters (except newline/tab) and cap length. This is not
// trying to prevent prompt injection (an LLM's own instructions can't fully
// stop that), it's basic hygiene: no null bytes, no runaway payloads, no
// absurd history sizes reaching the model or logs.
function cleanText(text) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .slice(0, MAX_MESSAGE_LENGTH);
}

export function sanitizeChatBody(req, res, next) {
  const { persona, messages } = req.body || {};

  if (typeof persona !== "string" || !persona) {
    return res.status(400).json({ error: "Missing or invalid 'persona'." });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'messages'." });
  }

  const trimmedHistory = messages.slice(-MAX_HISTORY_MESSAGES);
  req.body.messages = trimmedHistory.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: cleanText(m.content),
  }));

  next();
}
