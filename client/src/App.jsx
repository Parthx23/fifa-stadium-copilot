/**
 * @fileoverview Main React App component.
 * Manages the active persona state, fetches persona configurations dynamically from
 * the server, and renders the app header, ticker, rail selector, and chat window.
 * Falls back to static configurations on fetch failure to prevent disruption.
 */

import { useState, useEffect } from "react";
import Ticker from "./components/Ticker.jsx";
import PersonaSelector from "./components/PersonaSelector.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import { PERSONAS as staticPersonas } from "./data/personas.js";
import { getPersonas } from "./api.js";

export default function App() {
  const [personas, setPersonas] = useState(staticPersonas);
  const [personaId, setPersonaId] = useState("fan");

  useEffect(() => {
    getPersonas()
      .then((data) => {
        if (data && data.length > 0) {
          setPersonas(data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load server personas, using static fallback:", err);
      });
  }, []);

  const persona = personas.find((p) => p.id === personaId) || personas[0] || staticPersonas[0];

  return (
    <div className="app">
      <Ticker />
      <header className="app__header">
        <h1 className="app__title">Matchday Copilot</h1>
        <p className="app__subtitle">
          Stadium assistant for FIFA World Cup 2026™ · {persona.label} mode
        </p>
      </header>
      <div className="app__body">
        <PersonaSelector activeId={personaId} personas={personas} onSelect={setPersonaId} />
        <ChatWindow persona={personaId} starterPrompts={persona.starterPrompts} />
      </div>
    </div>
  );
}
