import { describe, expect, it } from "vitest";

import { buildBundle } from "../src/build.js";

// The build pipeline silently ignores keys it doesn't recognise on a goal/section
// spec. These tests pin the non-fatal warnings that surface the typo - the two
// real-world misses being `target` (the field is `targetValue`) and a misspelled
// section `nested`.
describe("unknown spec-key validation", () => {
  it("warns on an unknown goal key with a 'did you mean' for a near-miss", () => {
    const { bundle, warnings } = buildBundle({
      mode: "section",
      sectionName: "Bossing",
      // `target` is wrong - the field is `targetValue`. Silently defaulted to 1 KC before.
      goals: [{ id: "zuk", type: "BOSS", name: "TzKal-Zuk", target: 1500 } as never],
    });

    // Non-fatal: the bundle still builds.
    expect(bundle.goals).toHaveLength(1);
    expect(warnings).toContain('goal "zuk": unknown key "target" — did you mean "targetValue"?');
  });

  it("warns on an unknown section key with a suggestion", () => {
    const { warnings } = buildBundle({
      sections: [
        // `nestted` is a typo for `nested`.
        { name: "Tree", nestted: true, goals: [{ type: "skill", skill: "Attack", level: 90 }] } as never,
      ],
    });

    expect(warnings.some((w) => w.includes('section: unknown key "nestted" — did you mean "nested"?'))).toBe(true);
  });

  it("an unknown key with no near match is flagged as ignored, not suggested", () => {
    const { warnings } = buildBundle({
      mode: "section",
      sectionName: "Misc",
      goals: [{ id: "x", type: "custom", name: "Thing", wobble: 7 } as never],
    });

    expect(warnings).toContain('goal "x": unknown key "wobble" — ignored.');
  });

  it("known keys never warn (single-section and multi-section)", () => {
    const single = buildBundle({
      mode: "section",
      sectionName: "OK",
      goals: [{ id: "a", type: "BOSS", name: "Zulrah", targetValue: 100, requires: [] }],
    });
    expect(single.warnings.filter((w) => w.includes("unknown key"))).toHaveLength(0);

    const multi = buildBundle({
      sharedBy: "Andrew",
      sections: [
        { name: "S1", nested: true, sectionColorRgb: 123, goals: [{ type: "skill", skill: "Attack", xp: 200_000_000 }] },
        { targetDefault: true, goals: [{ type: "ITEM_GRIND", name: "Twisted bow", targetValue: 1 }] },
      ],
    });
    expect(multi.warnings.filter((w) => w.includes("unknown key"))).toHaveLength(0);
  });

  it("does not double-warn for a multi-section goal (validated once, not on re-entry)", () => {
    const { warnings } = buildBundle({
      sections: [{ name: "S", goals: [{ id: "g", type: "BOSS", name: "Zulrah", target: 5 } as never] }],
    });
    const hits = warnings.filter((w) => w.includes('unknown key "target"'));
    expect(hits).toHaveLength(1);
  });
});
