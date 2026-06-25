import { describe, expect, it } from "vitest";

import { buildBundle } from "../src/build.js";
import { encode, decode } from "../src/codec.js";
import { effectiveSections, needsV2 } from "../src/bundle.js";
import { describeBundle } from "../src/describe.js";

const SLAYER = [{ type: "ITEM_GRIND", name: "Imbued heart" }];
const RAIDS = [
  { id: "rng", type: "skill", skill: "Ranged", level: 90 },
  { id: "zuk", type: "BOSS", name: "TzKal-Zuk", requires: ["rng"] },
];

describe("multi-section crafting (GPSHARE2)", () => {
  it("carries each section's nested-view preference through encode/decode", () => {
    const { bundle } = buildBundle({
      sharedBy: "Andrew",
      sections: [
        { name: "Nested", nested: true, goals: [{ type: "skill", skill: "Attack", level: 90 }] },
        { name: "Flat", nested: false, goals: [{ type: "skill", skill: "Defence", level: 90 }] },
        { name: "Default", goals: [{ type: "skill", skill: "Magic", level: 90 }] },
      ],
    });
    const secs = decode(encode(bundle)).sections!;
    const by = (n: string) => secs.find((s) => s.name === n)!;
    expect(by("Nested").nestedOverride).toBe(true);
    expect(by("Flat").nestedOverride).toBe(false);
    expect(by("Default").nestedOverride).toBeUndefined();
  });

  it("a single nested section forces the v2 wire so nestedOverride survives", () => {
    // The v1 wire has nowhere to carry nestedOverride; a lone nested section must
    // therefore upgrade to GPSHARE2 or the preference is silently dropped on import.
    const { bundle } = buildBundle({
      sections: [{ name: "Nested", nested: true, goals: [{ type: "skill", skill: "Attack", level: 90 }] }],
    });
    expect(needsV2(bundle)).toBe(true);
    const code = encode(bundle);
    expect(code.startsWith("GPSHARE2:")).toBe(true);
    expect(decode(code).sections![0].nestedOverride).toBe(true);
  });

  it("a sections[] spec builds one bundle with one entry per section", () => {
    const { bundle, resolved, warnings } = buildBundle({
      sharedBy: "Andrew",
      sections: [
        { name: "Slayer", goals: SLAYER },
        { name: "Raids", goals: RAIDS },
      ],
    });
    expect(bundle.sections).toHaveLength(2);
    expect(bundle.sections![0].name).toBe("Slayer");
    expect(bundle.sections![1].goals).toHaveLength(2);
    expect(resolved).toHaveLength(3);
    expect(resolved.every((r) => r.tracked)).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("relation refs are scoped per section", () => {
    const { bundle } = buildBundle({
      sections: [
        { name: "A", goals: [{ type: "skill", skill: "Attack", level: 99 }] },
        { name: "B", goals: RAIDS },
      ],
    });
    const zuk = bundle.sections![1].goals.find((g) => g.type === "BOSS")!;
    const ranged = bundle.sections![1].goals.find((g) => g.type === "SKILL")!;
    expect(zuk.requires).toEqual([ranged.ref]);
  });

  it("multi-section bundles encode as GPSHARE2 and round-trip", () => {
    const { bundle } = buildBundle({
      sections: [
        { name: "Slayer", goals: SLAYER },
        { name: "Raids", goals: RAIDS },
      ],
    });
    const code = encode(bundle);
    expect(code.startsWith("GPSHARE2:")).toBe(true);
    const decoded = decode(code);
    expect(decoded.v).toBe(2);
    expect(decoded.sections).toHaveLength(2);
    expect(decoded.sections![1].goals).toHaveLength(2);
  });

  it("a single default-target section needs the v2 wire", () => {
    const { bundle } = buildBundle({
      sections: [{ targetDefault: true, goals: SLAYER }],
    });
    expect(needsV2(bundle)).toBe(true);
    const code = encode(bundle);
    expect(code.startsWith("GPSHARE2:")).toBe(true);
    expect(decode(code).sections![0].targetDefault).toBe(true);
  });

  it("a single plain section crafted via sections[] still emits the v1 wire", () => {
    const { bundle } = buildBundle({
      sections: [{ name: "Slayer", goals: SLAYER }],
    });
    const code = encode(bundle);
    expect(code.startsWith("GPSHARE1:")).toBe(true);
    const decoded = decode(code);
    expect(decoded.kind).toBe("SECTION");
    expect(decoded.sectionName).toBe("Slayer");
    expect(effectiveSections(decoded)[0].goals).toHaveLength(1);
  });

  it("legacy single-section specs are untouched (v1 wire, regression)", () => {
    const { bundle } = buildBundle({ mode: "section", sectionName: "Inferno", goals: RAIDS });
    expect(encode(bundle).startsWith("GPSHARE1:")).toBe(true);
  });

  it("the preview groups goals per section and flags default-targeting", () => {
    const { preview } = buildBundle({
      sections: [
        { name: "Raids", goals: RAIDS },
        { targetDefault: true, goals: SLAYER },
      ],
    });
    expect(preview).toContain("2 sections");
    expect(preview).toContain('Section 1/2: "Raids"');
    expect(preview).toContain("Default plan");
    expect(preview).toContain("reused");
  });

  it("warnings are prefixed with their section label", () => {
    const { warnings } = buildBundle({
      sections: [{ name: "Misc", goals: [{ type: "ITEM_GRIND", name: "definitely not an item xyz" }] }],
    });
    expect(warnings.some((w) => w.startsWith("[Misc]"))).toBe(true);
  });

  it("decode_import_string's breakdown renders v2 sections", () => {
    const { bundle } = buildBundle({
      sections: [
        { name: "Slayer", goals: SLAYER },
        { targetDefault: true, goals: RAIDS },
      ],
    });
    const text = describeBundle(decode(encode(bundle)));
    expect(text).toContain("Schema version: v2");
    expect(text).toContain("Sections: 2");
    expect(text).toContain('"Slayer"');
    expect(text).toContain("DEFAULT plan");
  });

  it("group fan-out works inside a section (all elite diaries → 12)", () => {
    const { bundle } = buildBundle({
      sections: [{ name: "Diaries", goals: [{ type: "DIARY", name: "all elite diaries" }] }],
    });
    expect(bundle.sections![0].goals).toHaveLength(12);
  });
});

describe("cross-section dependency edges (crossEdges)", () => {
  // Zuk (section 2) needs Ranged 90 (same section, stays a ref edge) AND the
  // Imbued heart from section 1 (crosses sections → bundle-level crossEdges).
  const CROSS = {
    sections: [
      { name: "Slayer", goals: [{ id: "heart", type: "ITEM_GRIND", name: "Imbued heart" }] },
      {
        name: "Raids",
        goals: [
          { id: "rng", type: "skill", skill: "Ranged", level: 90 },
          { id: "zuk", type: "BOSS", name: "TzKal-Zuk", requires: ["rng", "heart"] },
        ],
      },
    ],
  };

  it("a requires id in another section becomes a crossEdges entry, not a dropped edge", () => {
    const { bundle, warnings } = buildBundle(CROSS);
    expect(warnings).toHaveLength(0);
    expect(bundle.crossEdges).toEqual([{ fromSection: 1, fromRef: 1, toSection: 0, toRef: 0, or: false }]);
    // The section-local edge still rides on the goal's own refs.
    expect(bundle.sections![1].goals[1].requires).toEqual([0]);
  });

  it("a two-section spec with a cross-section edge round-trips encode→decode intact", () => {
    const { bundle } = buildBundle(CROSS);
    const code = encode(bundle);
    expect(code.startsWith("GPSHARE2:")).toBe(true);
    const decoded = decode(code);
    expect(decoded.crossEdges).toEqual([{ fromSection: 1, fromRef: 1, toSection: 0, toRef: 0, or: false }]);
    expect(decoded.sections![1].goals[1].requires).toEqual([0]);
  });

  it("orRequires across sections carries or:true", () => {
    const { bundle } = buildBundle({
      sections: [
        { name: "Slayer", goals: [{ id: "heart", type: "ITEM_GRIND", name: "Imbued heart" }] },
        { name: "Raids", goals: [{ id: "zuk", type: "BOSS", name: "TzKal-Zuk", orRequires: ["heart"] }] },
      ],
    });
    expect(bundle.crossEdges).toEqual([{ fromSection: 1, fromRef: 0, toSection: 0, toRef: 0, or: true }]);
    expect(decode(encode(bundle)).crossEdges![0].or).toBe(true);
  });

  it("the preview marks cross-section prerequisites with their source section", () => {
    const { preview } = buildBundle(CROSS);
    expect(preview).toContain("1 cross-section dependency link");
    expect(preview).toContain('needs "Imbued heart" — from section 1 "Slayer"');
  });

  it("the decode breakdown lists cross-section dependencies with resolved goal names", () => {
    const { bundle } = buildBundle(CROSS);
    const text = describeBundle(decode(encode(bundle)));
    expect(text).toContain("Cross-section dependencies (1)");
    expect(text).toContain('"TzKal-Zuk" (section 2 "Raids") requires "Imbued heart" (section 1 "Slayer")');
  });

  it("no crossEdges field when nothing crosses sections", () => {
    const { bundle } = buildBundle({
      sections: [
        { name: "Slayer", goals: SLAYER },
        { name: "Raids", goals: RAIDS },
      ],
    });
    expect(bundle.crossEdges).toBeUndefined();
    expect(decode(encode(bundle)).crossEdges).toBeUndefined();
  });

  it("an id unknown in every section still drops with the usual warning", () => {
    const { bundle, warnings } = buildBundle({
      sections: [
        { name: "A", goals: SLAYER },
        { name: "B", goals: [{ id: "zuk", type: "BOSS", name: "TzKal-Zuk", requires: ["nope"] }] },
      ],
    });
    expect(bundle.crossEdges).toBeUndefined();
    expect(warnings.some((w) => w.includes('unknown goal id "nope"'))).toBe(true);
  });

  it("an id duplicated across several other sections is ambiguous and drops", () => {
    const dup = [{ id: "heart", type: "ITEM_GRIND", name: "Imbued heart" }];
    const { bundle, warnings } = buildBundle({
      sections: [
        { name: "A", goals: dup },
        { name: "B", goals: dup },
        { name: "C", goals: [{ id: "zuk", type: "BOSS", name: "TzKal-Zuk", requires: ["heart"] }] },
      ],
    });
    expect(bundle.crossEdges).toBeUndefined();
    expect(warnings.some((w) => w.includes("ambiguous"))).toBe(true);
  });

  it("a cycle through two sections is detected and the closing edge dropped", () => {
    const { bundle, warnings } = buildBundle({
      sections: [
        { name: "A", goals: [{ id: "a", type: "skill", skill: "Attack", level: 99, requires: ["b"] }] },
        { name: "B", goals: [{ id: "b", type: "skill", skill: "Defence", level: 99, requires: ["a"] }] },
      ],
    });
    expect(bundle.crossEdges).toHaveLength(1);
    expect(warnings.some((w) => w.includes("cycle"))).toBe(true);
  });
});

describe("decode breakdown echoes per-goal description/tooltip", () => {
  it("shows description and tooltip so round-trips verify completely", () => {
    const { bundle } = buildBundle({
      mode: "section",
      sectionName: "Echo",
      goals: [
        { type: "custom", name: "Read the guide", description: "Check the wiki first", tooltip: "hover text" },
      ],
    });
    const text = describeBundle(decode(encode(bundle)));
    expect(text).toContain("desc: Check the wiki first");
    expect(text).toContain("tooltip: hover text");
  });

  it("shows descriptions inside v2 sections too", () => {
    const { bundle } = buildBundle({
      sections: [
        { name: "A", goals: [{ type: "ITEM_GRIND", name: "Imbued heart", description: "From slayer caves" }] },
        { name: "B", goals: RAIDS },
      ],
    });
    const text = describeBundle(decode(encode(bundle)));
    expect(text).toContain("desc: From slayer caves");
  });
});
