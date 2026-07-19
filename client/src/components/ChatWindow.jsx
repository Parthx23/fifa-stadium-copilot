import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble.jsx";
import ToolCallCard from "./ToolCallCard.jsx";
import { sendChat } from "../api.js";

export default function ChatWindow({ persona, starterPrompts }) {
  const [thread, setThread] = useState([]); // { role, content } for the API
  const [items, setItems] = useState([]); // rendered items: message | tool
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Reset the conversation when switching persona — each role starts fresh.
    setThread([]);
    setItems([]);
    setDraft("");
  }, [persona]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items, loading]);

  async function submit(text) {
    const message = text.trim();
    if (!message || loading) return;

    const nextThread = [...thread, { role: "user", content: message }];
    setThread(nextThread);
    setItems((prev) => [...prev, { type: "message", role: "user", content: message }]);
    setDraft("");
    setLoading(true);

    try {
      const { reply, toolTrace } = await sendChat(persona, nextThread);

      for (const call of toolTrace || []) {
        setItems((prev) => [...prev, { type: "tool", ...call }]);
      }
      setItems((prev) => [...prev, { type: "message", role: "assistant", content: reply }]);
      setThread((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setItems((prev) => [...prev, { type: "message", role: "assistant", content: err.message, isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submit(draft);
  }

  return (
    <section className="chat" aria-label="Matchday Copilot chat">
      <div className="chat__messages" ref={scrollRef}>
        {items.length === 0 && (
          <div className="chat__empty">
            <p>Ask about entry, wayfinding, transport, schedule, or anything else for this role. Try:</p>
            <ul>
              {starterPrompts.map((p) => (
                <li key={p}>
                  <button type="button" onClick={() => submit(p)} style={{ all: "unset", cursor: "pointer", color: "var(--pitch)", textDecoration: "underline" }}>
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.map((item, i) =>
          item.type === "message" ? (
            <MessageBubble key={i} role={item.role} content={item.content} isError={item.isError} />
          ) : (
            <ToolCallCard key={i} tool={item.tool} input={item.input} result={item.result} />
          )
        )}

        {loading && <MessageBubble role="assistant" content="Checking live data…" />}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <label htmlFor="composer-input" style={{ position: "absolute", left: "-9999px" }}>
          Message Matchday Copilot
        </label>
        <input
          id="composer-input"
          className="composer__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Matchday Copilot…"
          autoComplete="off"
        />
        <button className="composer__send" type="submit" disabled={loading || !draft.trim()} aria-label="Send message">
          Send
        </button>
      </form>
    </section>
  );
}
