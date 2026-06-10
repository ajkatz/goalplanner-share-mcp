import { describe, expect, it } from "vitest";

import { QUESTS, QUEST_COUNT } from "../src/refdata/quests.data.js";
import { QUEST_ALIASES, isKnownQuestEnum, resolveQuest, searchQuests } from "../src/refdata/quests.js";
import { buildBundle, TYPED_CORE } from "../src/build.js";

describe("quest refdata integrity", () => {
  it("ships the full quest corpus (200+ entries, count export matches)", () => {
    expect(QUESTS.length).toBeGreaterThan(150);
    expect(QUEST_COUNT).toBe(QUESTS.length);
  });

  it("every display name round-trips to its own enum constant", () => {
    for (const q of QUESTS) {
      const hit = resolveQuest(q.displayName);
      expect(hit?.enumName, `display "${q.displayName}"`).toBe(q.enumName);
    }
  });

  it("every enum constant resolves to itself (questName passthrough by name)", () => {
    for (const q of QUESTS) {
      expect(resolveQuest(q.enumName)?.enumName, q.enumName).toBe(q.enumName);
    }
  });

  it("every curated alias points at a real enum constant", () => {
    const known = new Set(QUESTS.map((q) => q.enumName));
    for (const [alias, target] of Object.entries(QUEST_ALIASES)) {
      expect(known.has(target), `alias "${alias}" → ${target}`).toBe(true);
    }
  });
});

describe("quest name resolution", () => {
  it("matches display names case-insensitively with punctuation noise", () => {
    expect(resolveQuest("dragon slayer ii")?.enumName).toBe("DRAGON_SLAYER_II");
    expect(resolveQuest("Another Slice of HAM")?.enumName).toBe("ANOTHER_SLICE_OF_HAM");
    expect(resolveQuest("mournings end part ii")?.enumName).toBe("MOURNINGS_END_PART_II");
    expect(resolveQuest("between a rock")?.enumName).toBe("BETWEEN_A_ROCK");
  });

  it("accepts arabic numerals for roman-numbered quests", () => {
    expect(resolveQuest("Dragon Slayer 2")?.enumName).toBe("DRAGON_SLAYER_II");
    expect(resolveQuest("monkey madness 1")?.enumName).toBe("MONKEY_MADNESS_I");
    expect(resolveQuest("desert treasure 2 the fallen empire")?.enumName).toBe(
      "DESERT_TREASURE_II__THE_FALLEN_EMPIRE",
    );
  });

  it('tolerates a missing/extra leading "The"', () => {
    expect(resolveQuest("Corsair Curse")?.enumName).toBe("THE_CORSAIR_CURSE");
    expect(resolveQuest("Fremennik Trials")?.enumName).toBe("THE_FREMENNIK_TRIALS");
  });

  it("resolves a unique prefix when the full subtitle is omitted", () => {
    expect(resolveQuest("Desert Treasure 2")?.enumName).toBe("DESERT_TREASURE_II__THE_FALLEN_EMPIRE");
    expect(resolveQuest("while guthix")?.enumName).toBe("WHILE_GUTHIX_SLEEPS");
  });

  it("resolves community abbreviations", () => {
    expect(resolveQuest("ds2")?.enumName).toBe("DRAGON_SLAYER_II");
    expect(resolveQuest("RFD")?.enumName).toBe("RECIPE_FOR_DISASTER");
    expect(resolveQuest("sote")?.enumName).toBe("SONG_OF_THE_ELVES");
    expect(resolveQuest("wgs")?.enumName).toBe("WHILE_GUTHIX_SLEEPS");
    expect(resolveQuest("mep2")?.enumName).toBe("MOURNINGS_END_PART_II");
  });

  it("plain Recipe for Disaster is the umbrella quest, not a subquest", () => {
    expect(resolveQuest("Recipe for Disaster")?.enumName).toBe("RECIPE_FOR_DISASTER");
  });

  it("returns null for unknown names and offers suggestions", () => {
    expect(resolveQuest("Quest of the Unwritten")).toBeNull();
    const sugg = searchQuests("dragon", 5);
    expect(sugg.length).toBeGreaterThan(0);
    expect(sugg.map((s) => s.enumName)).toContain("DRAGON_SLAYER_I");
  });

  it("validates explicit enum constants regardless of case", () => {
    expect(isKnownQuestEnum("DRAGON_SLAYER_I")?.enumName).toBe("DRAGON_SLAYER_I");
    expect(isKnownQuestEnum("dragon_slayer_i")?.enumName).toBe("DRAGON_SLAYER_I");
    expect(isKnownQuestEnum("DRAGON_SLAYER_III")).toBeNull();
  });
});

describe("QUEST goals in buildBundle", () => {
  it("QUEST is typed core", () => {
    expect(TYPED_CORE).toContain("QUEST");
  });

  it("crafts a tracked quest goal carrying the ENUM constant on the wire", () => {
    const { bundle, resolved } = buildBundle({
      sectionName: "Quests",
      goals: [{ type: "QUEST", name: "Dragon Slayer 2" }],
    });
    const dto = bundle.goals[0];
    expect(dto.type).toBe("QUEST");
    expect(dto.questName).toBe("DRAGON_SLAYER_II");
    expect(dto.name).toBe("Dragon Slayer II");
    expect(dto.targetValue).toBe(1);
    expect(resolved[0].tracked).toBe(true);
  });

  it("accepts a known explicit questName and keeps the caller's label", () => {
    const { bundle, resolved, warnings } = buildBundle({
      sectionName: "Quests",
      goals: [{ type: "QUEST", name: "Do the dragon quest", questName: "DRAGON_SLAYER_I" }],
    });
    expect(bundle.goals[0].questName).toBe("DRAGON_SLAYER_I");
    expect(bundle.goals[0].name).toBe("Do the dragon quest");
    expect(resolved[0].tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("passes an unknown explicit questName through UNVERIFIED with a warning", () => {
    const { bundle, resolved, warnings } = buildBundle({
      sectionName: "Quests",
      goals: [{ type: "QUEST", name: "Future quest", questName: "DRAGON_SLAYER_III" }],
    });
    expect(bundle.goals[0].questName).toBe("DRAGON_SLAYER_III");
    expect(resolved[0].tracked).toBe(false);
    expect(warnings.some((w) => w.includes("DRAGON_SLAYER_III"))).toBe(true);
  });

  it("falls back to CUSTOM with suggestions when the name is unresolvable", () => {
    const { bundle, resolved, warnings } = buildBundle({
      sectionName: "Quests",
      goals: [{ type: "QUEST", name: "dragon slayr" }],
    });
    expect(bundle.goals[0].type).toBe("CUSTOM");
    expect(resolved[0].tracked).toBe(false);
    expect(warnings.some((w) => w.toLowerCase().includes("closest matches"))).toBe(true);
  });
});
