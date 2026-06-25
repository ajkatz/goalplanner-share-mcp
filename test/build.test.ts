import { describe, it, expect } from "vitest";
import { buildBundle, type ShareSpec } from "../src/build.js";
import { xpForLevel } from "../src/refdata/skills.js";

const spec = (goals: ShareSpec["goals"], extra: Partial<ShareSpec> = {}): ShareSpec => ({
  mode: "section",
  sectionName: "Test",
  goals,
  ...extra,
});

describe("buildBundle — typed core", () => {
  it("resolves a skill goal to SKILL + XP and marks it tracked", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "skill", skill: "ranged", level: 90 }]));
    const g = bundle.goals[0]!;
    expect(g.type).toBe("SKILL");
    expect(g.skillName).toBe("RANGED");
    expect(g.targetValue).toBe(xpForLevel(90));
    expect(g.name).toBe("Ranged - Level 90");
    expect(resolved[0]!.tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("accepts explicit xp over level", () => {
    const { bundle } = buildBundle(spec([{ type: "skill", skill: "Attack", xp: 13034431 }]));
    expect(bundle.goals[0]!.targetValue).toBe(13034431);
  });

  it("falls back to CUSTOM with a warning for an unknown skill", () => {
    // Summoning is an RS3 skill, never in OSRS — a safe "unknown" example.
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "skill", skill: "Summoning", level: 50 }]));
    expect(bundle.goals[0]!.type).toBe("CUSTOM");
    expect(resolved[0]!.tracked).toBe(false);
    expect(warnings.join(" ")).toMatch(/unknown skill/i);
  });

  it("builds a CUSTOM goal as-is", () => {
    const { bundle } = buildBundle(spec([{ type: "custom", name: "Buy a bond", colorRgb: 0xff0000 }]));
    expect(bundle.goals[0]).toMatchObject({ type: "CUSTOM", name: "Buy a bond", customColorRgb: 0xff0000 });
  });
});

describe("buildBundle — BOSS typed core", () => {
  it("recognizes a known boss by bossName and tracks it (1 KC default)", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "boss", name: "Beat the Inferno", bossName: "TzKal-Zuk" }]));
    expect(bundle.goals[0]).toMatchObject({ type: "BOSS", bossName: "TzKal-Zuk", targetValue: 1, name: "Beat the Inferno" });
    expect(resolved[0]!.tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("resolves a boss from the name field and aliases, case-insensitively", () => {
    expect(buildBundle(spec([{ type: "boss", name: "Zulrah" }])).bundle.goals[0]).toMatchObject({ type: "BOSS", bossName: "Zulrah" });
    expect(buildBundle(spec([{ type: "boss", name: "the inferno" }])).bundle.goals[0]!.bossName).toBe("TzKal-Zuk");
    expect(buildBundle(spec([{ type: "boss", bossName: "jad" }])).bundle.goals[0]!.bossName).toBe("TzTok-Jad");
  });

  it("honors an explicit KC target", () => {
    expect(buildBundle(spec([{ type: "boss", bossName: "Vorkath", targetValue: 50 }])).bundle.goals[0]!.targetValue).toBe(50);
  });

  it("emits an unknown boss as UNVERIFIED (not tracked) but keeps the name", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "boss", bossName: "Bandos Avatar" }]));
    expect(bundle.goals[0]).toMatchObject({ type: "BOSS", bossName: "Bandos Avatar" });
    expect(resolved[0]!.tracked).toBe(false);
    expect(warnings.join(" ")).toMatch(/not in the known boss list/);
  });
});

describe("buildBundle — item source tags", () => {
  it("tags a collection-log item with its drop source (system tag, default colour)", () => {
    const { bundle, resolved } = buildBundle(spec([{ type: "ITEM_GRIND", name: "Pegasian crystal" }]));
    const g = bundle.goals[0]!;
    expect(g.type).toBe("ITEM_GRIND");
    expect(g.tags).toEqual([{ label: "Cerberus", category: "BOSS", colorRgb: -1, system: true }]);
    // Preview surfaces the source label too.
    expect(resolved[0]!.tags).toEqual(["Cerberus"]);
  });

  it("carries multiple source tags for a shared drop (boss + All Pets)", () => {
    // Araxxor pet (29836): tagged both by its boss and the All Pets clog page.
    const { bundle } = buildBundle(spec([{ type: "ITEM_GRIND", name: "Nid", itemId: 29836 }]));
    const labels = (bundle.goals[0]!.tags ?? []).map((t) => t.label);
    expect(labels).toContain("Araxxor");
    expect(labels).toContain("All Pets");
  });

  it("emits no tags for a non-collection-log item", () => {
    const { bundle, resolved } = buildBundle(spec([{ type: "ITEM_GRIND", name: "Nature rune", targetValue: 1000 }]));
    expect(bundle.goals[0]!.tags).toBeUndefined();
    expect(resolved[0]!.tags).toBeUndefined();
  });
});

describe("buildBundle — Phase 2 types", () => {
  it("tracks an explicit valid quest enum constant (typed core since Phase 2)", () => {
    const { bundle, resolved, warnings } = buildBundle(
      spec([{ type: "quest", name: "Dragon Slayer II", questName: "DRAGON_SLAYER_II" }]),
    );
    expect(bundle.goals[0]).toMatchObject({ type: "QUEST", questName: "DRAGON_SLAYER_II" });
    expect(resolved[0]!.tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("falls back to CUSTOM when an untyped kind has no identifier", () => {
    const { bundle, warnings } = buildBundle(spec([{ type: "collection_log", name: "All pets" }]));
    expect(bundle.goals[0]!.type).toBe("CUSTOM");
    expect(warnings.join(" ")).toMatch(/CUSTOM/);
  });
});

describe("buildBundle — tree wiring", () => {
  it("wires requires by id to bundle-local ref indices", () => {
    const { bundle } = buildBundle(
      spec([
        { id: "quest", type: "custom", name: "Do quest", requires: ["range", "def"] },
        { id: "range", type: "skill", skill: "Ranged", level: 70 },
        { id: "def", type: "skill", skill: "Defence", level: 70 },
      ]),
    );
    expect(bundle.goals[0]!.requires).toEqual([1, 2]); // refs of range, def
    expect(bundle.goals[1]!.requires).toBeUndefined();
  });

  it("drops a dangling edge with a warning", () => {
    const { bundle, warnings } = buildBundle(
      spec([{ id: "a", type: "custom", name: "A", requires: ["ghost"] }]),
    );
    expect(bundle.goals[0]!.requires).toBeUndefined();
    expect(warnings.join(" ")).toMatch(/unknown goal id "ghost"/);
  });

  it("prevents a dependency cycle", () => {
    const { bundle, warnings } = buildBundle(
      spec([
        { id: "a", type: "custom", name: "A", requires: ["b"] },
        { id: "b", type: "custom", name: "B", requires: ["a"] },
      ]),
    );
    // a→b wired; b→a would close a cycle → dropped.
    expect(bundle.goals[0]!.requires).toEqual([1]);
    expect(bundle.goals[1]!.requires).toBeUndefined();
    expect(warnings.join(" ")).toMatch(/cycle/);
  });

  it("drops a self-edge", () => {
    const { warnings } = buildBundle(spec([{ id: "a", type: "custom", name: "A", requires: ["a"] }]));
    expect(warnings.join(" ")).toMatch(/itself/);
  });
});

describe("buildBundle — bundle shape", () => {
  it("SECTION mode carries the section name; GOALS mode omits it", () => {
    const s = buildBundle(spec([{ type: "custom", name: "x" }], { mode: "section", sectionName: "My Plan" }));
    expect(s.bundle).toMatchObject({ kind: "SECTION", sectionName: "My Plan" });
    const g = buildBundle({ mode: "goals", goals: [{ type: "custom", name: "x" }] });
    expect(g.bundle.kind).toBe("GOALS");
    expect(g.bundle.sectionName).toBeUndefined();
  });

  it("preview renders the goal list: header, type+detail tags, tracking badges, nested guide", () => {
    const { preview } = buildBundle(
      spec(
        [
          { id: "fire", type: "custom", name: "Beat the Inferno", requires: ["range"] },
          { id: "range", type: "skill", skill: "Ranged", level: 90 },
        ],
        { sectionName: "Inferno prep", sharedBy: "me" },
      ),
    );
    expect(preview).toMatch(/Section: "Inferno prep"/);
    expect(preview).toMatch(/Shared by: me/);
    // Order: prereq appears ABOVE the final goal.
    const prereqLine = preview.split("\n").findIndex((l) => /Ranged - Level 90/.test(l));
    const goalLine = preview.split("\n").findIndex((l) => /Beat the Inferno/.test(l));
    expect(prereqLine).toBeGreaterThanOrEqual(0);
    expect(prereqLine).toBeLessThan(goalLine); // do-first prereq is above the final goal
    // Nesting: the PREREQ is flush-left, the FINAL goal is indented beneath it.
    expect(preview).toMatch(/^Ranged - Level 90 {3}\[Skill · Level 90 \([\d,]+ xp\)\]  ✓ auto-tracks/m);
    expect(preview).toMatch(/^ {2}Beat the Inferno {3}\[Custom\]  ○ manual {3}◀ final goal/m);
  });

  it("preview lists tracked vs custom counts and warnings", () => {
    const { preview } = buildBundle(
      spec([
        { type: "skill", skill: "Magic", level: 75 }, // tracked
        { type: "quest", name: "Some Quest" }, // no questName → CUSTOM fallback + warning
      ]),
    );
    expect(preview).toMatch(/1 auto-track · 1 manual/);
    expect(preview).toMatch(/⚠ Warnings/);
  });
});
