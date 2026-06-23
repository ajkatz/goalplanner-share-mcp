import { describe, expect, it } from "vitest";

import { resolveSkill, SKILLS, xpForLevel } from "../src/refdata/skills.js";

describe("skill refdata", () => {
  it("covers all 24 RuneLite skills (Sailing included)", () => {
    expect(Object.keys(SKILLS)).toHaveLength(24);
    expect(SKILLS.SAILING).toBe("Sailing");
  });

  it("resolves Sailing by display name and enum name, any case", () => {
    expect(resolveSkill("Sailing")).toBe("SAILING");
    expect(resolveSkill("sailing")).toBe("SAILING");
    expect(resolveSkill("SAILING")).toBe("SAILING");
  });

  it("uses the universal XP curve for every skill (level 95 = 8,771,558 xp)", () => {
    // Sailing shares the standard OSRS level→XP table, so a base-95 target
    // is the same XP as any other skill.
    expect(xpForLevel(95)).toBe(8_771_558);
  });
});
