import { describe, it, expect } from "vitest";
import { resolveItem, itemNameById, isKnownItemId, searchItems, ITEM_COUNT } from "../src/refdata/items.js";
import { buildBundle, type ShareSpec } from "../src/build.js";

const spec = (goals: ShareSpec["goals"], extra: Partial<ShareSpec> = {}): ShareSpec => ({
  mode: "section",
  sectionName: "Test",
  goals,
  ...extra,
});

describe("resolveItem — OSRS objtypes corpus", () => {
  it("loaded a substantial item corpus", () => {
    expect(ITEM_COUNT).toBeGreaterThan(15000);
  });

  it("resolves single- and multi-word display names by normalization", () => {
    expect(resolveItem("Abyssal whip")?.itemId).toBe(4151);
    expect(resolveItem("Magic logs")?.itemId).toBe(1513);
    expect(resolveItem("Iron ore")?.itemId).toBe(440);
    expect(resolveItem("Bandos chestplate")?.itemId).toBe(11832);
    expect(resolveItem("Dragon bones")?.itemId).toBe(536);
    expect(resolveItem("Rune platebody")?.itemId).toBe(1127);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(resolveItem("  aBySsAl   whip ")?.itemId).toBe(4151);
    expect(resolveItem("SHARK")?.itemId).toBe(385);
  });

  it("returns the base item, not a _lava/_ice variant, for the plain name", () => {
    expect(resolveItem("Abyssal whip")?.codename).toBe("abyssal_whip");
  });

  it("resolves divergent codenames via the curated alias map", () => {
    expect(resolveItem("Cannonball")).toMatchObject({ itemId: 2, name: "Cannonball" });
    expect(resolveItem("Prayer potion")?.itemId).toBe(2434);
    expect(resolveItem("prayer potion(4)")?.itemId).toBe(2434);
  });

  it("returns null for an unrecognized name", () => {
    expect(resolveItem("definitely not a real item xyzzy")).toBeNull();
    expect(resolveItem("")).toBeNull();
    expect(resolveItem(undefined)).toBeNull();
  });

  it("maps a known id back to a prettified display name", () => {
    expect(itemNameById(4151)).toBe("Abyssal whip");
    expect(isKnownItemId(4151)).toBe(true);
    expect(itemNameById(99999999)).toBeNull();
    expect(isKnownItemId(99999999)).toBe(false);
  });
});

describe("resolveItem — hardening (aliases, variants, ambiguity)", () => {
  it("resolves curated combat-potion and pet-nickname aliases", () => {
    expect(resolveItem("Super combat potion")?.itemId).toBe(12695);
    expect(resolveItem("Super strength")?.itemId).toBe(2440);
    expect(resolveItem("Super defence")?.itemId).toBe(2442);
    expect(resolveItem("Bastion potion")?.itemId).toBe(22461);
    // Collection-log pet nicknames whose codename omits the boss name.
    expect(resolveItem("Abyssal orphan")?.itemId).toBe(13262);
    expect(resolveItem("Ikkle hydra")?.itemId).toBe(22746);
    expect(resolveItem("Vorki")?.itemId).toBe(21992);
    expect(resolveItem("Little nightmare")?.itemId).toBe(24491);
  });

  it("resolves a pet whose name DOES contain the boss via loose match (no alias needed)", () => {
    expect(resolveItem("Vorkath pet")?.itemId).toBe(21992);
  });

  it("folds a parenthetical variant suffix into the codename form", () => {
    expect(resolveItem("Abyssal dagger(p++)")?.itemId).toBe(13271);
  });

  it("returns the BASE item for the plain name, not a poisoned/charged variant", () => {
    expect(resolveItem("Abyssal dagger")?.itemId).toBe(13265);
  });

  it("does not confidently resolve a genuinely ambiguous loose key (safe miss)", () => {
    // `bronze_dart_p` / `_p+` / `_p++` all collapse to one loose key; an input that
    // can't be pinned to one of them must miss rather than guess.
    expect(resolveItem("bronzedartp")).toBeNull();
  });
});

describe("searchItems — candidate suggestions", () => {
  it("ranks an exact codename match first", () => {
    expect(searchItems("Dragon dagger")[0]?.itemId).toBe(1215);
    expect(searchItems("Abyssal whip")[0]?.itemId).toBe(4151);
  });

  it("returns multiple ranked candidates for a partial/ambiguous query", () => {
    const r = searchItems("Dragon dag");
    expect(r.length).toBeGreaterThan(1);
    expect(r.map((m) => m.itemId)).toContain(1215);
  });

  it("respects the limit and returns nothing for gibberish or empty input", () => {
    expect(searchItems("dragon", 3).length).toBeLessThanOrEqual(3);
    expect(searchItems("notarealitem zzz qqq")).toHaveLength(0);
    expect(searchItems("")).toHaveLength(0);
    expect(searchItems(undefined)).toHaveLength(0);
  });
});

describe("buildBundle — ITEM_GRIND typed core", () => {
  it("resolves an item name to a verified, auto-tracking goal (default qty 1)", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "item", name: "Abyssal whip" }]));
    const g = bundle.goals[0]!;
    expect(g.type).toBe("ITEM_GRIND");
    expect(g.itemId).toBe(4151);
    expect(g.targetValue).toBe(1);
    expect(g.name).toBe("Abyssal whip");
    expect(resolved[0]!.tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("honors an explicit quantity target", () => {
    const { bundle } = buildBundle(spec([{ type: "item_grind", name: "Magic logs", targetValue: 10000 }]));
    expect(bundle.goals[0]).toMatchObject({ type: "ITEM_GRIND", itemId: 1513, targetValue: 10000 });
  });

  it("validates an explicit itemId against the corpus and tracks it", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "item", itemId: 4151 }]));
    expect(bundle.goals[0]).toMatchObject({ type: "ITEM_GRIND", itemId: 4151, name: "Abyssal whip" });
    expect(resolved[0]!.tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("keeps a caller-supplied name over the corpus display name", () => {
    const { bundle } = buildBundle(spec([{ type: "item", itemId: 4151, name: "BiS melee weapon" }]));
    expect(bundle.goals[0]!.name).toBe("BiS melee weapon");
  });

  it("emits an unknown explicit itemId as UNVERIFIED (not tracked) but keeps it typed", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "item", itemId: 99999999 }]));
    expect(bundle.goals[0]).toMatchObject({ type: "ITEM_GRIND", itemId: 99999999 });
    expect(resolved[0]!.tracked).toBe(false);
    expect(resolved[0]!.note).toBe("unverified identifier");
    expect(warnings.join(" ")).toMatch(/not in the known item table/i);
  });

  it("falls back to CUSTOM with a warning when a name can't be resolved and no id is given", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "item", name: "Shadowy unknowable relic" }]));
    expect(bundle.goals[0]!.type).toBe("CUSTOM");
    expect(resolved[0]!.tracked).toBe(false);
    expect(warnings.join(" ")).toMatch(/not recognized/i);
  });

  it("enriches a near-miss warning with closest-match suggestions", () => {
    const { warnings } = buildBundle(spec([{ type: "item", name: "Dragon dag" }]));
    const w = warnings.join(" ");
    expect(w).toMatch(/closest matches/i);
    expect(w).toMatch(/itemId 1215/);
  });
});
