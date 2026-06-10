import { describe, expect, it } from "vitest";

import { ACCOUNT_METRICS, ACCOUNT_METRIC_COUNT } from "../src/refdata/accounts.data.js";
import {
  ACCOUNT_ALIASES,
  isKnownAccountMetric,
  resolveAccountMetric,
  searchAccountMetrics,
} from "../src/refdata/accounts.js";
import { buildBundle, TYPED_CORE } from "../src/build.js";

describe("account-metric refdata integrity", () => {
  it("ships every plugin metric (14+, count export matches)", () => {
    expect(ACCOUNT_METRICS.length).toBeGreaterThanOrEqual(14);
    expect(ACCOUNT_METRIC_COUNT).toBe(ACCOUNT_METRICS.length);
  });

  it("every display name round-trips to its own enum constant", () => {
    for (const m of ACCOUNT_METRICS) {
      expect(resolveAccountMetric(m.displayName)?.enumName, m.displayName).toBe(m.enumName);
    }
  });

  it("every enum constant resolves to itself", () => {
    for (const m of ACCOUNT_METRICS) {
      expect(resolveAccountMetric(m.enumName)?.enumName, m.enumName).toBe(m.enumName);
    }
  });

  it("every curated alias points at a real metric", () => {
    const known = new Set(ACCOUNT_METRICS.map((m) => m.enumName));
    for (const [alias, target] of Object.entries(ACCOUNT_ALIASES)) {
      expect(known.has(target), `alias "${alias}" → ${target}`).toBe(true);
    }
  });

  it("leagues metrics are flagged (seasonal-world tracking only)", () => {
    expect(ACCOUNT_METRICS.find((m) => m.enumName === "LEAGUE_POINTS")?.leagues).toBe(true);
    expect(ACCOUNT_METRICS.find((m) => m.enumName === "QUEST_POINTS")?.leagues).toBe(false);
  });
});

describe("account-metric resolution", () => {
  it("matches display names loosely", () => {
    expect(resolveAccountMetric("quest points")?.enumName).toBe("QUEST_POINTS");
    expect(resolveAccountMetric("Total level")?.enumName).toBe("TOTAL_LEVEL");
    expect(resolveAccountMetric("att str")?.enumName).toBe("ATT_STR_COMBINED");
    expect(resolveAccountMetric("tears of guthix")?.enumName).toBe("TOG_MAX_TEARS");
  });

  it("resolves community shorthand", () => {
    expect(resolveAccountMetric("qp")?.enumName).toBe("QUEST_POINTS");
    expect(resolveAccountMetric("kudos")?.enumName).toBe("KUDOS");
    expect(resolveAccountMetric("combat")?.enumName).toBe("COMBAT_LEVEL");
    expect(resolveAccountMetric("ca points")?.enumName).toBe("CA_POINTS");
  });

  it("returns null for unknown metrics and offers suggestions", () => {
    expect(resolveAccountMetric("bank value")).toBeNull();
    expect(searchAccountMetrics("points", 10).length).toBeGreaterThanOrEqual(3);
  });

  it("validates explicit enum constants regardless of case", () => {
    expect(isKnownAccountMetric("quest_points")?.enumName).toBe("QUEST_POINTS");
    expect(isKnownAccountMetric("BANK_VALUE")).toBeNull();
  });
});

describe("ACCOUNT goals in buildBundle", () => {
  it("ACCOUNT is typed core", () => {
    expect(TYPED_CORE).toContain("ACCOUNT");
  });

  it("crafts a tracked account goal carrying the ENUM constant on the wire", () => {
    const { bundle, resolved, warnings } = buildBundle({
      sectionName: "Account",
      goals: [{ type: "ACCOUNT", name: "quest points", targetValue: 200 }],
    });
    expect(bundle.goals[0]).toMatchObject({
      type: "ACCOUNT",
      accountMetric: "QUEST_POINTS",
      name: "Quest Points",
      targetValue: 200,
    });
    expect(resolved[0].tracked).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("defaults a missing target to the metric's max with a warning", () => {
    const { bundle, warnings } = buildBundle({
      sectionName: "Account",
      goals: [{ type: "account", name: "total level" }],
    });
    expect(bundle.goals[0].targetValue).toBe(2376);
    expect(warnings.some((w) => w.includes("2,376") || w.includes("2376"))).toBe(true);
  });

  it("warns on an out-of-range target but still tracks", () => {
    const { resolved, warnings } = buildBundle({
      sectionName: "Account",
      goals: [{ type: "account", name: "quest points", targetValue: 999 }],
    });
    expect(resolved[0].tracked).toBe(true);
    expect(warnings.some((w) => w.includes("333"))).toBe(true);
  });

  it("notes leagues metrics as seasonal-world-only", () => {
    const { resolved } = buildBundle({
      sectionName: "Leagues",
      goals: [{ type: "account", name: "league points", targetValue: 5200 }],
    });
    expect(resolved[0].tracked).toBe(true);
    expect(resolved[0].note?.toLowerCase()).toContain("leagues");
  });

  it("accepts a known explicit accountMetric and keeps the caller's label", () => {
    const { bundle, resolved } = buildBundle({
      sectionName: "Account",
      goals: [{ type: "ACCOUNT", name: "Quest cape progress", accountMetric: "QUEST_POINTS", targetValue: 333 }],
    });
    expect(bundle.goals[0].accountMetric).toBe("QUEST_POINTS");
    expect(bundle.goals[0].name).toBe("Quest cape progress");
    expect(resolved[0].tracked).toBe(true);
  });

  it("passes an unknown explicit accountMetric through UNVERIFIED with a warning", () => {
    const { bundle, resolved, warnings } = buildBundle({
      sectionName: "Account",
      goals: [{ type: "ACCOUNT", name: "Bank value", accountMetric: "BANK_VALUE", targetValue: 1 }],
    });
    expect(bundle.goals[0].accountMetric).toBe("BANK_VALUE");
    expect(resolved[0].tracked).toBe(false);
    expect(warnings.some((w) => w.includes("BANK_VALUE"))).toBe(true);
  });

  it("falls back to CUSTOM with suggestions when the metric is unresolvable", () => {
    const { bundle, warnings } = buildBundle({
      sectionName: "Account",
      goals: [{ type: "account", name: "bank value" }],
    });
    expect(bundle.goals[0].type).toBe("CUSTOM");
    expect(warnings.some((w) => w.toLowerCase().includes("not recognized"))).toBe(true);
  });
});
