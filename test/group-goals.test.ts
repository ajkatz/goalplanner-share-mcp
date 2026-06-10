import { describe, it, expect } from "vitest";
import { resolveBossGroup } from "../src/refdata/boss-groups.js";
import { resolveDiaryGroup } from "../src/refdata/diaries.js";
import { buildBundle, type ShareSpec } from "../src/build.js";

const spec = (goals: ShareSpec["goals"], extra: Partial<ShareSpec> = {}): ShareSpec => ({
  mode: "section",
  sectionName: "Test",
  goals,
  ...extra,
});

describe("resolveBossGroup", () => {
  it("resolves named boss collections to their members", () => {
    const gwd = resolveBossGroup("GWD");
    expect(gwd?.name).toBe("God Wars Dungeon");
    expect(gwd!.members).toEqual(["Commander Zilyana", "General Graardor", "K'ril Tsutsaroth", "Kree'arra"]);
    expect(resolveBossGroup("Dagannoth Kings")!.members).toHaveLength(3);
    expect(resolveBossGroup("wildy")?.name).toBe("Wilderness bosses");
  });

  it("handles 'all bosses' and aliases, and rejects non-groups", () => {
    expect(resolveBossGroup("all bosses")!.members.length).toBeGreaterThan(80);
    expect(resolveBossGroup("god wars dungeon")?.name).toBe("God Wars Dungeon");
    expect(resolveBossGroup("Zulrah")).toBeNull(); // a single boss, not a group
    expect(resolveBossGroup("nonsense")).toBeNull();
  });
});

describe("resolveDiaryGroup", () => {
  it("expands an 'all <tier>' request across every area", () => {
    const elite = resolveDiaryGroup("all elite diaries");
    expect(elite?.name).toBe("All Elite diaries");
    expect(elite!.members).toHaveLength(12);
    expect(elite!.members.every((m) => m.tier === "ELITE")).toBe(true);
  });

  it("expands an 'all <area>' request across every tier", () => {
    const ard = resolveDiaryGroup("all Ardougne diaries");
    expect(ard!.members).toHaveLength(4);
    expect(ard!.members.every((m) => m.area === "ARDOUGNE")).toBe(true);
  });

  it("expands a bare 'all diaries' to the full set", () => {
    expect(resolveDiaryGroup("all diaries")!.members).toHaveLength(48);
  });

  it("requires an 'all'/'every' trigger so single diaries route elsewhere", () => {
    expect(resolveDiaryGroup("Ardougne Elite")).toBeNull();
    expect(resolveDiaryGroup("Varrock hard diary")).toBeNull();
  });
});

describe("buildBundle — boss/diary group expansion", () => {
  it("fans a boss group into one verified BOSS goal per member", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "boss", name: "GWD" }]));
    expect(bundle.goals).toHaveLength(4);
    expect(bundle.goals.every((g) => g.type === "BOSS")).toBe(true);
    expect(bundle.goals.map((g) => g.bossName)).toContain("Kree'arra");
    expect(resolved.every((r) => r.tracked)).toBe(true);
    expect(warnings.join(" ")).toMatch(/expanded "GWD" into 4 God Wars Dungeon/i);
  });

  it("fans 'all elite diaries' into 12 verified DIARY goals", () => {
    const { bundle, resolved } = buildBundle(spec([{ type: "diary", name: "all elite diaries" }]));
    expect(bundle.goals).toHaveLength(12);
    expect(bundle.goals.every((g) => g.type === "DIARY" && (g.varbitId ?? 0) > 0)).toBe(true);
    expect(resolved.every((r) => r.tracked)).toBe(true);
  });

  it("leaves a single boss/diary goal untouched (no spurious expansion)", () => {
    expect(buildBundle(spec([{ type: "boss", name: "Zulrah" }])).bundle.goals).toHaveLength(1);
    expect(buildBundle(spec([{ type: "diary", name: "Ardougne Elite" }])).bundle.goals).toHaveLength(1);
  });
});
