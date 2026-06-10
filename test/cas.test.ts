import { describe, expect, it } from "vitest";

import { CAS, CA_COUNT } from "../src/refdata/cas.data.js";
import { caTierSprite, isKnownCaTaskId, resolveCa, searchCas } from "../src/refdata/cas.js";
import { buildBundle, TYPED_CORE } from "../src/build.js";

describe("combat-achievement refdata integrity", () => {
  it("ships the full task corpus (600+, count export matches)", () => {
    expect(CAS.length).toBeGreaterThan(600);
    expect(CA_COUNT).toBe(CAS.length);
  });

  it("all task ids are unique and inside the 0–639 varplayer bit range", () => {
    const ids = new Set<number>();
    for (const c of CAS) {
      expect(c.caTaskId).toBeGreaterThanOrEqual(0);
      expect(c.caTaskId).toBeLessThanOrEqual(639);
      expect(ids.has(c.caTaskId), `duplicate id ${c.caTaskId}`).toBe(false);
      ids.add(c.caTaskId);
    }
  });

  it("every task name round-trips to its own id", () => {
    for (const c of CAS) {
      expect(resolveCa(c.name)?.caTaskId, c.name).toBe(c.caTaskId);
    }
  });

  it("every tier maps to a sword sprite (plugin parity: 3399–3404)", () => {
    for (const c of CAS) {
      const sprite = caTierSprite(c.tier);
      expect(sprite, c.tier).toBeGreaterThanOrEqual(3399);
      expect(sprite).toBeLessThanOrEqual(3404);
    }
  });
});

describe("combat-achievement resolution", () => {
  it("matches task names case-insensitively", () => {
    expect(resolveCa("noxious foe")?.caTaskId).toBe(0);
    expect(resolveCa("Abyssal Veteran")?.tier).toBe("Elite");
  });

  it("validates explicit task ids", () => {
    expect(isKnownCaTaskId(0)?.name).toBe("Noxious Foe");
    const used = new Set(CAS.map((c) => c.caTaskId));
    const gap = [...Array(640).keys()].find((i) => !used.has(i));
    expect(gap).toBeDefined();
    expect(isKnownCaTaskId(gap!)).toBeNull();
  });

  it("suggests tasks for near-miss names (typo-tolerant, monster-aware)", () => {
    expect(searchCas("noxious fo", 5).map((c) => c.name)).toContain("Noxious Foe");
    expect(searchCas("abyssal sire", 10).length).toBeGreaterThanOrEqual(3);
  });
});

describe("COMBAT_ACHIEVEMENT goals in buildBundle", () => {
  it("COMBAT_ACHIEVEMENT is typed core", () => {
    expect(TYPED_CORE).toContain("COMBAT_ACHIEVEMENT");
  });

  it("crafts a tracked CA goal with plugin-parity sprite + description", () => {
    const { bundle, resolved, warnings } = buildBundle({
      sectionName: "CAs",
      goals: [{ type: "COMBAT_ACHIEVEMENT", name: "Noxious Foe" }],
    });
    expect(bundle.goals[0]).toMatchObject({
      type: "COMBAT_ACHIEVEMENT",
      caTaskId: 0,
      name: "Noxious Foe",
      targetValue: 1,
      spriteId: 3399,
      description: "Easy Combat Achievement",
    });
    expect(resolved[0].tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("accepts a known explicit caTaskId and fills the canonical name", () => {
    const { bundle, resolved } = buildBundle({
      sectionName: "CAs",
      goals: [{ type: "combat_achievement", name: "", caTaskId: 2 }],
    });
    expect(bundle.goals[0].name).toBe("Abyssal Veteran");
    expect(resolved[0].tracked).toBe(true);
  });

  it("passes an in-range but unknown caTaskId through UNVERIFIED", () => {
    const used = new Set(CAS.map((c) => c.caTaskId));
    const gap = [...Array(640).keys()].find((i) => !used.has(i))!;
    const { resolved, warnings } = buildBundle({
      sectionName: "CAs",
      goals: [{ type: "combat_achievement", name: "Mystery task", caTaskId: gap }],
    });
    expect(resolved[0].tracked).toBe(false);
    expect(warnings.some((w) => w.includes(String(gap)))).toBe(true);
  });

  it("warns hard on an out-of-range caTaskId (recipient will never track it)", () => {
    const { resolved, warnings } = buildBundle({
      sectionName: "CAs",
      goals: [{ type: "combat_achievement", name: "Bad id", caTaskId: 700 }],
    });
    expect(resolved[0].tracked).toBe(false);
    expect(warnings.some((w) => w.includes("0–639") || w.includes("0-639"))).toBe(true);
  });

  it("falls back to CUSTOM with suggestions when the name is unresolvable", () => {
    const { bundle, warnings } = buildBundle({
      sectionName: "CAs",
      goals: [{ type: "combat_achievement", name: "noxious fo" }],
    });
    expect(bundle.goals[0].type).toBe("CUSTOM");
    expect(warnings.some((w) => w.includes("Noxious Foe"))).toBe(true);
  });
});
