import { Fragment } from "react";

function statusDotClass(value) {
  const v = String(value || "").toLowerCase();
  if (["low", "on-time"].includes(v)) return "status-dot status-dot--low";
  if (["medium", "minor-delay"].includes(v)) return "status-dot status-dot--medium";
  if (["high", "major-delay"].includes(v)) return "status-dot status-dot--high";
  if (v === "critical") return "status-dot status-dot--critical";
  return null;
}

export default function ToolCallCard({ tool, input, result }) {
  const entries = Object.entries(result || {}).filter(([k]) => k !== "steps" && k !== "matches");

  return (
    <div className="tool-card" aria-label={`Live data lookup: ${tool}`}>
      <div className="tool-card__head">
        <span>{tool.replaceAll("_", " ")}</span>
        <span>{Object.values(input || {}).join(" · ")}</span>
      </div>
      <div className="tool-card__body">
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <span className="tool-card__key">{key}</span>
            <span>
              {statusDotClass(value) && <span className={statusDotClass(value)} aria-hidden="true" />}
              {typeof value === "boolean" ? (value ? "yes" : "no") : String(value)}
            </span>
          </Fragment>
        ))}
        {Array.isArray(result?.steps) && (
          <Fragment>
            <span className="tool-card__key">steps</span>
            <span>{result.steps.join(" → ")}</span>
          </Fragment>
        )}
        {Array.isArray(result?.matches) && (
          <Fragment>
            <span className="tool-card__key">matches</span>
            <span>{result.matches.length ? JSON.stringify(result.matches) : "none"}</span>
          </Fragment>
        )}
      </div>
    </div>
  );
}
