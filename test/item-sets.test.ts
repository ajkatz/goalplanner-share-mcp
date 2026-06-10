import { describe, it, expect } from "vitest";
import {
  resolveItem,
  resolveItemSet,
  resolveLoadout,
  resolveItemGroup,
  resolveItemsPhrase,
  isMultiItemPhrase,
} from "../src/refdata/items.js";
import { buildBundle, type ShareSpec } from "../src/build.js";

const spec = (goals: ShareSpec["goals"], extra: Partial<ShareSpec> = {}): ShareSpec => ({
  mode: "section",
  sectionName: "Test",
  goals,
  ...extra,
});

const ids = (arr: { itemId: number }[]) => arr.map((m) => m.itemId);

describe("nickname aliases", () => {
  it("resolves common weapon abbreviations to their canonical item", () => {
    expect(resolveItem("bp")).toMatchObject({ itemId: 12924, name: "Toxic blowpipe" });
    expect(resolveItem("tbow")).toMatchObject({ itemId: 20997, name: "Twisted bow" });
    expect(resolveItem("shadow")).toMatchObject({ itemId: 27275, name: "Tumeken's shadow" });
    expect(resolveItem("scythe")?.itemId).toBe(22325);
  });
});

describe("resolveItemSet", () => {
  it("expands 'full torva' into its three pieces", () => {
    const set = resolveItemSet("full torva");
    expect(set?.name).toBe("Torva");
    expect(ids(set!.members)).toEqual([26382, 26384, 26386]);
  });

  it("strips filler words (armour/set/gear) and is case-insensitive", () => {
    expect(ids(resolveItemSet("Masori armour")!.members)).toEqual([27226, 27229, 27232]);
    expect(resolveItemSet("BANDOS SET")?.name).toBe("Bandos");
  });

  it("distinguishes fortified masori via alias", () => {
    expect(ids(resolveItemSet("fortified masori")!.members)).toEqual([27235, 27238, 27241]);
  });

  it("returns null for a non-set", () => {
    expect(resolveItemSet("twisted bow")).toBeNull();
    expect(resolveItemSet("definitely not a set")).toBeNull();
  });
});

describe("resolveItemsPhrase", () => {
  it("combines a set and a single item across a '+'", () => {
    const { items, unresolved } = resolveItemsPhrase("full masori + tbow");
    expect(ids(items)).toEqual([27226, 27229, 27232, 20997]);
    expect(unresolved).toHaveLength(0);
  });

  it("splits on +, &, comma and 'and', de-duplicating", () => {
    const { items } = resolveItemsPhrase("tbow & tbow, shadow and bp");
    expect(ids(items)).toEqual([20997, 27275, 12924]); // tbow de-duped
  });

  it("reports parts it can't resolve", () => {
    const { items, unresolved } = resolveItemsPhrase("tbow + zzzzz nonsense");
    expect(ids(items)).toEqual([20997]);
    expect(unresolved).toEqual(["zzzzz nonsense"]);
  });

  it("isMultiItemPhrase flags sets and separator phrases, not single items", () => {
    expect(isMultiItemPhrase("full torva")).toBe(true);
    expect(isMultiItemPhrase("masori + tbow")).toBe(true);
    expect(isMultiItemPhrase("tbow")).toBe(false);
    expect(isMultiItemPhrase("Abyssal whip")).toBe(false);
  });
});

describe("resolveLoadout — BiS combat-style presets", () => {
  it("resolves 'maxed melee setup' to a full melee kit including the curated weapon", () => {
    // Armour is wiki-sourced (content drifts as BiS changes), so assert structure
    // + the stable curated weapon rather than exact wiki ids.
    const lo = resolveLoadout("maxed melee setup");
    expect(lo?.name).toBe("Maxed melee");
    expect(lo!.members.length).toBeGreaterThanOrEqual(7);
    expect(lo!.members.every((m) => m.itemId > 0 && m.name)).toBe(true);
    expect(ids(lo!.members)).toContain(22325); // Scythe of vitur (curated)
  });

  it("accepts style aliases (bis range, maxed magic)", () => {
    expect(resolveLoadout("bis range")?.name).toBe("Maxed ranged");
    expect(ids(resolveLoadout("bis range")!.members)).toContain(20997); // tbow
    expect(resolveLoadout("maxed magic")?.name).toBe("Maxed mage");
    expect(ids(resolveLoadout("maxed magic")!.members)).toContain(27275); // shadow
  });

  it("returns null for a non-loadout", () => {
    expect(resolveLoadout("twisted bow")).toBeNull();
    expect(resolveLoadout("full torva")).toBeNull(); // a set, not a loadout
  });

  it("resolveItemGroup unifies sets and loadouts", () => {
    expect(resolveItemGroup("full torva")?.name).toBe("Torva");
    expect(resolveItemGroup("maxed mage")?.name).toBe("Maxed mage");
    expect(resolveItemGroup("nonsense")).toBeNull();
  });
});

describe("buildBundle — set/phrase expansion", () => {
  it("fans 'full torva' into three verified, auto-tracking item goals", () => {
    const { bundle, resolved } = buildBundle(spec([{ type: "item", name: "full torva" }]));
    expect(bundle.goals.map((g) => g.itemId)).toEqual([26382, 26384, 26386]);
    expect(bundle.goals.every((g) => g.type === "ITEM_GRIND")).toBe(true);
    expect(resolved.every((r) => r.tracked)).toBe(true);
    expect(resolved.map((r) => r.name)).toEqual(["Torva full helm", "Torva platebody", "Torva platelegs"]);
  });

  it("expands a combined 'full masori + tbow' phrase into four goals", () => {
    const { bundle } = buildBundle(spec([{ type: "item", name: "full masori + tbow" }]));
    expect(bundle.goals.map((g) => g.itemId)).toEqual([27226, 27229, 27232, 20997]);
  });

  it("shows the canonical name for a single nickname goal", () => {
    const { bundle } = buildBundle(spec([{ type: "item", name: "bp" }]));
    expect(bundle.goals[0]).toMatchObject({ type: "ITEM_GRIND", itemId: 12924, name: "Toxic blowpipe" });
  });

  it("warns about an unresolved part but still emits the rest", () => {
    const { bundle, warnings } = buildBundle(spec([{ type: "item", name: "tbow + made up thing" }]));
    expect(bundle.goals.map((g) => g.itemId)).toEqual([20997]);
    expect(warnings.join(" ")).toMatch(/couldn't resolve "made up thing"/i);
  });

  it("fans a 'maxed melee setup' loadout into auto-tracking goals (incl. newer-than-snapshot ids)", () => {
    const { bundle, resolved } = buildBundle(spec([{ type: "item", name: "maxed melee setup" }]));
    expect(bundle.goals.length).toBeGreaterThanOrEqual(7);
    expect(bundle.goals.every((g) => g.type === "ITEM_GRIND")).toBe(true);
    // All track — including wiki-sourced ids newer than the objtypes snapshot.
    expect(resolved.every((r) => r.tracked)).toBe(true);
    expect(bundle.goals.map((g) => g.itemId)).toContain(22325); // Scythe of vitur (curated)
  });

  it("combines a loadout with an extra item across '+'", () => {
    const { bundle } = buildBundle(spec([{ type: "item", name: "maxed melee + shadow" }]));
    expect(bundle.goals).toHaveLength(10);
    expect(bundle.goals.map((g) => g.itemId)).toContain(27275); // Tumeken's shadow appended
  });
});
