import { describe, it, expect } from "vitest";
import { runTool, TOOL_MODULES, getDefinition } from "../tools/index.js";

describe("tool registry", () => {
  it("every registered tool has a name-matching definition", () => {
    for (const [name, mod] of Object.entries(TOOL_MODULES)) {
      expect(mod.definition.name).toBe(name);
      expect(typeof mod.run).toBe("function");
    }
  });

  it("getDefinition returns undefined for unknown tools", () => {
    expect(getDefinition("not_a_real_tool")).toBeUndefined();
  });
});

describe("get_gate_crowd_density", () => {
  it("returns a valid level for a known gate", () => {
    const result = runTool("get_gate_crowd_density", { gate: "A" });
    expect(["low", "medium", "high", "critical"]).toContain(result.level);
    expect(result.waitMinutes).toBeGreaterThan(0);
  });

  it("is deterministic for the same gate", () => {
    const a = runTool("get_gate_crowd_density", { gate: "C" });
    const b = runTool("get_gate_crowd_density", { gate: "C" });
    expect(a.level).toBe(b.level);
  });

  it("errors on an unknown gate", () => {
    const result = runTool("get_gate_crowd_density", { gate: "Z" });
    expect(result.error).toMatch(/Unknown gate/);
  });

  it("normalizes lowercase gate letters", () => {
    const result = runTool("get_gate_crowd_density", { gate: "a" });
    expect(result.gate).toBe("A");
  });
});

describe("get_wayfinding", () => {
  it("returns a step-free route when accessible is true", () => {
    const result = runTool("get_wayfinding", { from: "Gate D", to: "Section 120", accessible: true });
    expect(result.accessibleRoute).toBe(true);
    expect(result.steps.join(" ")).toMatch(/accessible|elevator/i);
  });

  it("always ends with arriving at the destination", () => {
    const result = runTool("get_wayfinding", { from: "Gate A", to: "Section 101" });
    expect(result.steps.at(-1)).toMatch(/Section 101/);
  });
});

describe("report_incident", () => {
  it("returns an incident id and a response ETA matching severity", () => {
    const result = runTool("report_incident", {
      type: "medical",
      location: "Section 108",
      severity: "critical",
    });
    expect(result.incidentId).toMatch(/^INC-/);
    expect(result.responseEta).toBe("immediate dispatch");
    expect(result.status).toBe("logged");
  });

  it("generates a unique incident id per call", () => {
    const a = runTool("report_incident", { type: "facility", location: "Gate B", severity: "low" });
    const b = runTool("report_incident", { type: "facility", location: "Gate B", severity: "low" });
    expect(a.incidentId).not.toBe(b.incidentId);
  });
});

describe("get_match_schedule", () => {
  it("returns all matches when no query is given", () => {
    const result = runTool("get_match_schedule", {});
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("filters by team name, case-insensitively", () => {
    const result = runTool("get_match_schedule", { query: "brazil" });
    expect(result.matches.every((m) => m.teams.toLowerCase().includes("brazil"))).toBe(true);
  });

  it("returns an empty list with a note for no matches", () => {
    const result = runTool("get_match_schedule", { query: "Narnia vs Atlantis" });
    expect(result.matches).toEqual([]);
    expect(result.note).toBeTruthy();
  });
});

describe("search_lost_found", () => {
  it("finds a logged item by partial description", () => {
    const result = runTool("search_lost_found", { itemDescription: "jacket" });
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("gives guidance to report at Guest Services when nothing matches", () => {
    const result = runTool("search_lost_found", { itemDescription: "flying carpet" });
    expect(result.matches).toEqual([]);
    expect(result.guidance).toMatch(/Guest Services/);
  });
});

describe("get_accessible_amenities and get_weather_advisory", () => {
  it("returns amenity info for a location", () => {
    const result = runTool("get_accessible_amenities", { location: "Gate D concourse" });
    expect(result.location).toBe("Gate D concourse");
    expect(typeof result.accessibleRestrooms).toBe("number");
  });

  it("flags a heat advisory only above the threshold", () => {
    const result = runTool("get_weather_advisory", { venue: "MetLife Stadium" });
    expect(typeof result.heatAdvisory).toBe("boolean");
    expect(result.heatAdvisory).toBe(result.tempC >= 32);
  });
});

describe("unknown tool handling", () => {
  it("runTool returns an error object instead of throwing", () => {
    const result = runTool("get_time_on_mars", {});
    expect(result.error).toMatch(/Unknown tool/);
  });
});
