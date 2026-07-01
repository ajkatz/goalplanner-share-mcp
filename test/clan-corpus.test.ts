import { describe, expect, it } from "vitest";

import { buildBundle, type GoalSpec } from "../src/build.js";
import { resolveItem } from "../src/refdata/items.js";

/**
 * Real-world corpus: goal lists collected from a clan's Discord
 * (test/fixtures/clan-discord-goals-raw.txt, verbatim). Each entry maps a
 * Discord line to the goal spec a competent MCP caller would pass, plus the
 * expected outcome. CUSTOM is a legitimate expectation for goals the plugin
 * can't auto-track (greenlogs, outfits, minigames, "learn X") — the assertion
 * there is graceful fallback, not resolution.
 */

type Expected =
  | { tracked: true; type: string; name?: string; identifier?: Record<string, string | number>; targetValue?: number }
  | { custom: true }
  | { unverified: true; type: string };

interface Case {
  line: string;
  spec: GoalSpec;
  expect: Expected;
}

const item = (line: string, name: string, canonical: string, targetValue?: number): Case => ({
  line,
  spec: { type: "ITEM_GRIND", name, ...(targetValue ? { targetValue } : {}) },
  expect: { tracked: true, type: "ITEM_GRIND", name: canonical, ...(targetValue ? { targetValue } : {}) },
});
const boss = (line: string, name: string, canonical: string, targetValue?: number): Case => ({
  line,
  spec: { type: "BOSS", name, ...(targetValue ? { targetValue } : {}) },
  expect: { tracked: true, type: "BOSS", identifier: { bossName: canonical } },
});
const account = (line: string, name: string, metric: string, targetValue: number, explicitTarget?: number): Case => ({
  line,
  spec: { type: "ACCOUNT", name, ...(explicitTarget ? { targetValue: explicitTarget } : {}) },
  expect: { tracked: true, type: "ACCOUNT", identifier: { accountMetric: metric }, targetValue },
});
const skill = (line: string, name: string, level: number): Case => ({
  line,
  spec: { type: "SKILL", skill: name, level } as GoalSpec,
  expect: { tracked: true, type: "SKILL" },
});
const custom = (line: string, name: string, type = "CUSTOM"): Case => ({
  line,
  spec: { type, name },
  expect: { custom: true },
});

const CASES: Case[] = [
  // ── Account goals ────────────────────────────────────────────────────────
  account("Grandmaster Combat Achievements", "Grandmaster Combat Achievements", "CA_POINTS", 2630),
  account("Get to Elite CAs", "Elite CAs", "CA_POINTS", 1064),
  account("Master cas", "Master cas", "CA_POINTS", 1904),
  account("Actually do gm cas and become gm", "gm cas", "CA_POINTS", 2630),
  account("Max TTL", "Max TTL", "TOTAL_LEVEL", 2376),
  account("Get closer to maxing", "maxing", "TOTAL_LEVEL", 2376),
  account("Maintain Quest Cape", "Maintain Quest Cape", "QUEST_POINTS", 339),
  account("Reach 2000 2100 total level", "total level", "TOTAL_LEVEL", 2100, 2100),
  account("greenlogging chompy birds (2900/4000)", "chompy kills", "CHOMPY_KILLS", 4000, 4000),
  // ── Slayer drops ─────────────────────────────────────────────────────────
  item("Imbued Heart", "Imbued heart", "Imbued heart"),
  item("Eternal Gem", "Eternal gem", "Eternal gem"),
  item("Noxious Point", "Noxious point", "Noxious point"),
  item("Noxious Blade", "Noxious blade", "Noxious blade"),
  item("Noxious Pommel", "Noxious pommel", "Noxious pommel"),
  // ── Boss drops (misc) ────────────────────────────────────────────────────
  item("Dragon Hunter Wand", "Dragon hunter wand", "Dragon hunter wand"),
  item("Zamorak Hilt", "Zamorak hilt", "Zamorak hilt"),
  item("Staff of the Dead", "Staff of the dead", "Staff of the dead"),
  item("Serp Visage", "Serp visage", "Serpentine visage"),
  item("Venator Ring", "Venator ring", "Venator ring"),
  item("Bellator Ring", "Bellator ring", "Bellator ring"),
  item("Ralos", "Ralos", "Tonalztics of ralos (uncharged)"),
  // ── Wilderness ───────────────────────────────────────────────────────────
  item("Voidwaker Blade", "Voidwaker blade", "Voidwaker blade"),
  item("Voidwaker Hilt", "Voidwaker hilt", "Voidwaker hilt"),
  item("Voidwaker Gem", "Voidwaker gem", "Voidwaker gem"),
  item("Claws of Callisto", "Claws of callisto", "Claws of callisto"),
  // ── Nex ──────────────────────────────────────────────────────────────────
  item("Torva full helm", "Torva full helm", "Torva full helm"),
  item("Torva Platebody", "Torva platebody", "Torva platebody"),
  item("Torva Platelegs", "Torva platelegs", "Torva platelegs"),
  item("Nihil Horn", "Nihil horn", "Nihil horn"),
  item("Vambs / Zaryte Vambraces", "Zaryte vambraces", "Zaryte vambraces"),
  item("ZCB", "zcb", "Zaryte crossbow"),
  // ── Raids ────────────────────────────────────────────────────────────────
  item("Elidinis Ward", "Elidinis ward", "Elidinis' ward"),
  item("Kodai", "Kodai", "Kodai wand"),
  item("Ancestral Top", "Ancestral top", "Ancestral robe top"),
  item("Ancy legs / Anc legs", "Ancy legs", "Ancestral robe bottom"),
  item("Dragon Claws", "Dragon claws", "Dragon claws"),
  item("Dragon Hunter Crossbow (DHCB)", "dhcb", "Dragon hunter crossbow"),
  item("Dins / Dinh's Bulwark", "Dins", "Dinh's bulwark"),
  item("Twisted Buckler", "Twisted buckler", "Twisted buckler"),
  item("Shadow", "shadow", "Tumeken's shadow"),
  item("Tbow", "tbow", "Twisted bow"),
  item("Fang kit", "Fang kit", "Cursed phalanx"),
  item("3 Twisted kits", "Twisted kit", "Twisted ancestral colour kit", 3),
  item("Sang kit", "Sang kit", "Sanguine ornament kit"),
  item("Sang dust / Sanguine Dust", "Sang dust", "Sanguine dust"),
  item("Justi chest / Justiciar Chestguard", "Justi chest", "Justiciar chestguard"),
  item("Elder Maul", "Elder maul", "Elder maul"),
  item("Masori mask", "Masori mask", "Masori mask"),
  item("Scythe", "scythe", "Scythe of vitur"),
  item("Avernic", "Avernic", "Avernic defender hilt"),
  // ── DT2 / side content ───────────────────────────────────────────────────
  item("Virtus Mask", "Virtus mask", "Virtus mask"),
  item("Ven vestige", "Ven vestige", "Venator vestige"),
  item("Bel vestige", "Bel vestige", "Bellator vestige"),
  item("Inq Helm", "Inq helm", "Inquisitor's great helm"),
  item("Inq Legs", "Inq legs", "Inquisitor's plateskirt"),
  item("Inq mace", "Inq mace", "Inquisitor's mace"),
  item("Inq body", "Inq body", "Inquisitor's hauberk"),
  item("Arcane Sigil", "Arcane sigil", "Arcane sigil"),
  item("Executioner's Axe Head", "Executioner's axe head", "Executioner's axe head"),
  item("Leviathan's Lure", "Leviathan's lure", "Leviathan's lure"),
  item("Eye of the Duke", "Eye of the duke", "Eye of the duke"),
  item("Blood Torva (3/4)", "Blood torva", "Ancient blood ornament kit", 3),
  // ── Pets / jars ──────────────────────────────────────────────────────────
  item("Jar of chemicals", "Jar of chemicals", "Jar of chemicals"),
  item("Moxi", "Moxi", "Moxi"),
  item("Jar of venom", "Jar of venom", "Jar of venom"),
  item("Callisto's Cub", "Callisto cub", "Callisto cub"),
  item("Karils Leathertop", "Karils leathertop", "Karil's leathertop"),
  item("Scorpia's Offspring", "Scorpia's offspring", "Scorpia's offspring"),
  // ── Quiver / CA cosmetics ────────────────────────────────────────────────
  item("Bless Quiver", "Bless quiver", "Blessed dizana's quiver"),
  item("Quiver", "Quiver", "Dizana's quiver (uncharged)"),
  // ── Gear upgrade lists ───────────────────────────────────────────────────
  item("Oathplate Helm", "Oathplate helm", "Oathplate helm"),
  item("Oathplate Chest", "Oathplate chest", "Oathplate chest"),
  item("Oathplate Legs", "Oathplate legs", "Oathplate legs"),
  item("zammy Hasta", "Zammy hasta", "Zamorakian hasta"),
  item("Amulet of Torture", "Amulet of torture", "Amulet of torture"),
  item("Rancour Amulet", "Rancour amulet", "Amulet of rancour"),
  item("Dragon Warhammer", "Dragon warhammer", "Dragon warhammer"),
  item("Emberlight", "Emberlight", "Emberlight"),
  item("Armadyl crossbow / Acb", "acb", "Armadyl crossbow"),
  item("Venator bow", "Venator bow", "Venator bow"),
  item("Scorching Bow", "Scorching bow", "Scorching bow"),
  item("Crystal armour seeds (1/6)", "Crystal armour seed", "Crystal armour seed", 6),
  item("Ranger boots / Rangers", "Rangers", "Ranger boots"),
  item("Ancient Sceptre", "Ancient sceptre", "Ancient sceptre"),
  item("Purging Staff", "Purging staff", "Purging staff"),
  item("Tormented Bracelet", "Tormented bracelet", "Tormented bracelet"),
  item("Eye of ayak", "Eye of ayak", "Eye of ayak"),
  item("Confliction Gauntlets", "Confliction gauntlets", "Confliction gauntlets"),
  item("Lightbearer", "Lightbearer", "Lightbearer"),
  item("Avernic Treads (base)", "Treads", "Avernic treads"),
  item("Zombie helmet", "Zombie helmet", "Zombie helmet"),
  item("Pharoah's Sceptre (to stash)", "Pharoah's sceptre", "Pharaoh's sceptre (uncharged)"),
  item("Ancient Effigy", "Ancient effigy", "Ancient effigy"),
  item("Tyrannical Ring", "Tyrannical ring", "Tyrannical ring"),
  item("Dragon pickaxe", "Dragon pickaxe", "Dragon pickaxe"),
  item("Eternals", "Eternals", "Eternal boots"),
  item("Fero", "Fero", "Ferocious gloves"),
  item("Lance", "Lance", "Dragon hunter lance"),
  item("Rancour", "Rancour", "Amulet of rancour"),
  item("Occult", "Occult", "Occult necklace"),
  item("Cloth (Doom)", "Mokhaiotl cloth", "Mokhaiotl cloth"),
  // ── Sailing (2026 content — freshness canary) ────────────────────────────
  item("Bottled Storm", "Bottled storm", "Bottled storm"),
  item("Broken Dragon Hook x2", "Broken dragon hook", "Broken dragon hook", 2),
  // ── Bosses / KC goals ────────────────────────────────────────────────────
  boss("500 Toa kc", "toa", "ToA", 500),
  boss("500 tob/hmt kc", "hmt", "ToB (HM)", 500),
  boss("1k cm kc", "cm", "CoX (CM)", 1000),
  boss("Bandos", "Bandos", "General Graardor"),
  boss("Muspah", "Muspah", "Phantom Muspah"),
  boss("Cerb", "Cerb", "Cerberus"),
  boss("Hydra", "Hydra", "Alchemical Hydra"),
  boss("Kree", "Kree", "Kree'arra"),
  boss("Duke", "Duke", "Duke Sucellus"),
  boss("Vardorvis", "Vardorvis", "Vardorvis"),
  boss("Whisperer", "Whisperer", "The Whisperer"),
  boss("Leviathan", "Leviathan", "The Leviathan"),
  boss("Araxxor", "Araxxor", "Araxxor"),
  boss("Sara (GWD)", "Sara", "Commander Zilyana"),
  boss("Corp", "Corp", "Corporeal Beast"),
  boss("Phosanis' Nightmare", "Pnm", "Phosani's Nightmare"),
  // ── Skills ───────────────────────────────────────────────────────────────
  skill("Get 99 Def", "Defence", 99),
  skill("Get a non-combat 99 (mining probably)", "Mining", 99),
  skill("Continue Slayer, ideally getting to 93", "Slayer", 93),
  // ── Legitimate CUSTOM fallbacks ──────────────────────────────────────────
  custom("SRA (1/4)", "SRA", "ITEM_GRIND"),
  custom("Any Complete Spirit Shield", "Any Complete Spirit Shield", "ITEM_GRIND"),
  custom("Mage Spell Upgrade (Royal Titans)", "Mage Spell Upgrade", "ITEM_GRIND"),
  custom("Everything (Phosani)", "Everything from Phosani's Nightmare"),
  custom("Radiant (oathplate recolor)", "Radiant oathplate", "ITEM_GRIND"),
  custom("Work through my stack of 50+ elite caskets", "Work through 50+ elite caskets and master clues"),
  custom("greenlogging trouble brewing", "Greenlog Trouble Brewing"),
  custom("greenlogging vale totems", "Greenlog Vale Totems"),
  custom("Dragon Tier Collection Log (1200 clogs)", "Dragon tier collection log (1200 slots)"),
  custom("Properly learn solo CM cox", "Learn solo CM CoX"),
  custom("Pet transmogs (ToA)", "ToA pet transmogs"),
  custom("Akha transmog", "Akha transmog"),
  custom("Magic Training Arena (3/11)", "Magic Training Arena clog"),
  custom("Barbarian Assault (1/11)", "Barbarian Assault clog"),
  custom("Mastering Mixology", "Mastering Mixology clog"),
  custom("Full Barrows (23/25)", "Full Barrows clog", "ITEM_GRIND"),
  custom("Prospector recolour", "Prospector recolour"),
  custom("Lumberjack outfit", "Lumberjack outfit", "ITEM_GRIND"),
  custom("Pyromancer outfit", "Pyromancer outfit", "ITEM_GRIND"),
  custom("Tithe farm clog", "Tithe farm collection log"),
  custom("Shooting Stars clog", "Shooting Stars collection log"),
];

describe("clan Discord corpus (test/fixtures/clan-discord-goals-raw.txt)", () => {
  for (const c of CASES) {
    it(`"${c.line}" → ${"custom" in c.expect ? "CUSTOM fallback" : `tracked ${c.expect.type}`}`, () => {
      const { bundle, resolved } = buildBundle({ sectionName: "Corpus", goals: [c.spec] });
      expect(bundle.goals.length).toBeGreaterThanOrEqual(1);
      const dto = bundle.goals[0];
      const res = resolved[0];

      if ("custom" in c.expect) {
        expect(dto.type, `expected CUSTOM, got ${dto.type} (${dto.name})`).toBe("CUSTOM");
        return;
      }

      expect(dto.type).toBe(c.expect.type);
      expect(res.tracked, `"${c.line}" should auto-track`).toBe(true);
      if (c.expect.name) expect(dto.name).toBe(c.expect.name);
      if (c.expect.targetValue) expect(dto.targetValue).toBe(c.expect.targetValue);
      for (const [k, v] of Object.entries(c.expect.identifier ?? {})) {
        expect((dto as unknown as Record<string, unknown>)[k], `${c.line}: ${k}`).toBe(v);
      }
    });
  }

  it("group lines fan out: 'All Achievement Diaries' → 48 tracked goals", () => {
    const { bundle, resolved } = buildBundle({
      sectionName: "Corpus",
      goals: [{ type: "DIARY", name: "all diaries" }],
    });
    expect(bundle.goals).toHaveLength(48);
    expect(resolved.every((r) => r.tracked)).toBe(true);
  });

  it("group lines fan out: 'Learn all GWD bosses' → 4 tracked boss goals", () => {
    const { bundle, resolved } = buildBundle({
      sectionName: "Corpus",
      goals: [{ type: "BOSS", name: "GWD" }],
    });
    expect(bundle.goals).toHaveLength(4);
    expect(resolved.every((r) => r.tracked)).toBe(true);
  });

  it("wiki-verified alias ids are exact (infobox-checked 2026-06-09)", () => {
    expect(resolveItem("Cursed phalanx")?.itemId).toBe(27248);
    expect(resolveItem("Sanguine dust")?.itemId).toBe(25746);
    expect(resolveItem("Sanguine ornament kit")?.itemId).toBe(25744);
    expect(resolveItem("Twisted ancestral colour kit")?.itemId).toBe(24670);
    expect(resolveItem("Blessed dizana's quiver")?.itemId).toBe(28955);
    expect(resolveItem("Noxious point")?.itemId).toBe(29790);
    expect(resolveItem("Noxious blade")?.itemId).toBe(29792);
    expect(resolveItem("Noxious pommel")?.itemId).toBe(29794);
  });
});
