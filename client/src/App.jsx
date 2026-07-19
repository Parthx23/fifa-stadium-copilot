import { useState } from "react";
import Ticker from "./components/Ticker.jsx";
import PersonaSelector from "./components/PersonaSelector.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import { PERSONAS } from "./data/personas.js";

export default function App() {
  const [personaId, setPersonaId] = useState("fan");
  const persona = PERSONAS.find((p) => p.id === personaId);

  return (
    <div className="app">
      <Ticker />
      <header className="app__header">
        <h1 className="app__title">Matchday Copilot</h1>
        <p className="app__subtitle">Stadium assistant for FIFA World Cup 2026 · {persona.label} mode</p>
      </header>
      <div className="app__body">
        <PersonaSelector activeId={personaId} onSelect={setPersonaId} />
        <ChatWindow persona={personaId} starterPrompts={persona.starterPrompts} />
      </div>
    </div>
  );
}
