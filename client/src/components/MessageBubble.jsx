export default function MessageBubble({ role, content, isError }) {
  const variant = isError ? "bubble--error" : role === "user" ? "bubble--user" : "bubble--assistant";
  return (
    <div className={`bubble ${variant}`} role={role === "assistant" ? "status" : undefined}>
      {content}
    </div>
  );
}
