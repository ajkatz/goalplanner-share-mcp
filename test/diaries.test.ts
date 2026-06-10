import { describe, it, expect } from "vitest";
import {
  resolveDiary,
  diaryNameByVarbit,
  isKnownDiaryVarbit,
  DIARY_COUNT,
} from "../src/refdata/diaries.js";
import { buildBundle, type ShareSpec } from "../src/build.js";

const spec = (goals: ShareSpec["goals"], extra: Partial<ShareSpec> = {}): ShareSpec => ({
  mode: "section",
  sectionName: "Test",
  goals,
  ...extra,
});

describe("resolveDiary — OSRS varbit-backed diary table", () => {
  it("covers 12 areas × 4 tiers", () => {
    expect(DIARY_COUNT).toBe(48);
  });

  it("resolves an area+tier to its completion varbit (boolean → target 1)", () => {
    expect(resolveDiary("Ardougne Elite")).toMatchObject({ varbitId: 4461, targetValue: 1 });
    expect(resolveDiary("varrock hard diary")).toMatchObject({ varbitId: 4481, targetValue: 1 });
  });

  it("uses the task-count varbit + total for Karamja Easy/Medium/Hard", () => {
    expect(resolveDiary("Karamja Easy")).toMatchObject({ varbitId: 2423, targetValue: 10 });
    expect(resolveDiary("Karamja Medium")).toMatchObject({ varbitId: 6288, targetValue: 19 });
    // Karamja Elite is a normal boolean COMPLETE varbit.
    expect(resolveDiary("Karamja Elite")).toMatchObject({ varbitId: 4566, targetValue: 1 });
  });

  it("is order-independent and tolerates 'diary' noise", () => {
    expect(resolveDiary("elite ardougne")?.varbitId).toBe(4461);
    expect(resolveDiary("Ardougne Elite Achievement Diary")?.varbitId).toBe(4461);
  });

  it("accepts area aliases (Lumbridge & Draynor, Western Provinces, Kourend & Kebos)", () => {
    expect(resolveDiary("Lumbridge & Draynor Medium")?.varbitId).toBe(4496);
    expect(resolveDiary("Western Provinces Elite")?.varbitId).toBe(4474);
    expect(resolveDiary("Kourend & Kebos hard")?.varbitId).toBe(7927);
  });

  it("returns null without a tier, for gibberish, or empty input", () => {
    expect(resolveDiary("Ardougne")).toBeNull();
    expect(resolveDiary("not a diary")).toBeNull();
    expect(resolveDiary(undefined)).toBeNull();
  });

  it("reverse-maps a known varbit and rejects unknown ones", () => {
    expect(diaryNameByVarbit(4461)).toBe("Ardougne Elite Diary");
    expect(isKnownDiaryVarbit(4461)).toBe(true);
    expect(isKnownDiaryVarbit(999999)).toBe(false);
    expect(diaryNameByVarbit(999999)).toBeNull();
  });
});

describe("buildBundle — DIARY typed core", () => {
  it("resolves a diary name to a verified, auto-tracking goal", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "diary", name: "Ardougne Elite" }]));
    const g = bundle.goals[0]!;
    expect(g.type).toBe("DIARY");
    expect(g.varbitId).toBe(4461);
    expect(g.targetValue).toBe(1);
    expect(g.name).toBe("Ardougne Elite");
    expect(resolved[0]!.tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("carries the Karamja count target through to the DTO", () => {
    expect(buildBundle(spec([{ type: "diary", name: "Karamja Medium" }])).bundle.goals[0]).toMatchObject({
      type: "DIARY",
      varbitId: 6288,
      targetValue: 19,
    });
  });

  it("validates an explicit known diary varbitId and tracks it", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "diary", varbitId: 4481 }]));
    expect(bundle.goals[0]).toMatchObject({ type: "DIARY", varbitId: 4481, name: "Varrock Hard Diary" });
    expect(resolved[0]!.tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("emits an unknown varbitId as UNVERIFIED but keeps it typed", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "diary", varbitId: 999999 }]));
    expect(bundle.goals[0]).toMatchObject({ type: "DIARY", varbitId: 999999 });
    expect(resolved[0]!.tracked).toBe(false);
    expect(resolved[0]!.note).toBe("unverified identifier");
    expect(warnings.join(" ")).toMatch(/not a known diary completion varbit/i);
  });

  it("falls back to CUSTOM with an actionable warning when the name can't be resolved", () => {
    const { bundle, resolved, warnings } = buildBundle(spec([{ type: "diary", name: "Lunar Isle Heroic" }]));
    expect(bundle.goals[0]!.type).toBe("CUSTOM");
    expect(resolved[0]!.tracked).toBe(false);
    expect(warnings.join(" ")).toMatch(/not recognized/i);
    expect(warnings.join(" ")).toMatch(/Easy\/Medium\/Hard\/Elite/);
  });
});
