import { describe, it, expect } from "vitest";
import { PERSONAS, getPersona, listPersonas } from "../personas.js";
import { TOOL_MODULES } from "../tools/index.js";

const ALL_TOOL_NAMES = Object.keys(TOOL_MODULES);

describe("persona configuration", () => {
  it("every persona only references real, registered tools", () => {
    for (const [id, persona] of Object.entries(PERSONAS)) {
      for (const toolName of persona.tools) {
        expect(ALL_TOOL_NAMES, `${id} references unknown tool ${toolName}`).toContain(toolName);
      }
    }
  });

  it("every tool is reachable by at least one persona", () => {
    const reachable = new Set(Object.values(PERSONAS).flatMap((p) => p.tools));
    for (const toolName of ALL_TOOL_NAMES) {
      expect(reachable.has(toolName), `${toolName} is unreachable by any persona`).toBe(true);
    }
  });

  it("fans cannot report incidents (staff-only capability)", () => {
    expect(PERSONAS.fan.tools).not.toContain("report_incident");
  });

  it("only organizers, volunteers, and venue staff can report incidents", () => {
    for (const id of ["organizer", "volunteer", "venue_staff"]) {
      expect(PERSONAS[id].tools).toContain("report_incident");
    }
  });

  it("getPersona returns null for an unknown id", () => {
    expect(getPersona("mascot")).toBeNull();
  });

  it("listPersonas exposes exactly the four defined personas", () => {
    const ids = listPersonas().map((p) => p.id).sort();
    expect(ids).toEqual(["fan", "organizer", "venue_staff", "volunteer"]);
  });
});
