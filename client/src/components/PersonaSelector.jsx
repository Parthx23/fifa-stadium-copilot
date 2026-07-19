import { PERSONAS } from "../data/personas.js";

export default function PersonaSelector({ activeId, onSelect }) {
  return (
    <nav className="persona-rail" aria-label="Choose your role">
      {PERSONAS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="persona-tab"
          aria-pressed={p.id === activeId}
          onClick={() => onSelect(p.id)}
        >
          <span className="persona-tab__label">{p.label}</span>
          <span className="persona-tab__tagline">{p.tagline}</span>
        </button>
      ))}
    </nav>
  );
}
