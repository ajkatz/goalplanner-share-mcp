// Regenerate src/refdata/diaries.data.ts from TWO sources:
//   1. the plugin's AchievementDiaryData.java — the (area, tier) structure, which
//      VarbitID constant tracks each, and the required value (1 for boolean
//      COMPLETE varbits; Karamja Easy/Med/Hard use COUNT varbits with a task total).
//   2. the OSRS cache varbittypes.txt — resolves each symbolic VarbitID constant
//      to its NUMERIC id (the runtime varbit the recipient's DiaryTracker reads).
//
// The plugin's `VarbitID.ARDOUGNE_DIARY_EASY_COMPLETE` is exactly the uppercase of
// the cache varbit name `ardougne_diary_easy_complete`, so the join is name-based.
//
// Usage: GOAL_PLANNER_REPO=/path OSRS_DATA_DIR=/path/to/data npm run gen:diaries
// Both default by auto-discovery (sibling repo / npx-installed mcp-osrs).
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));

function findOsrsDataDir() {
  if (process.env.OSRS_DATA_DIR) return process.env.OSRS_DATA_DIR;
  const npx = join(homedir(), ".npm", "_npx");
  if (existsSync(npx)) {
    for (const hash of readdirSync(npx)) {
      const dir = join(npx, hash, "node_modules", "@jayarrowz", "mcp-osrs", "dist", "data");
      if (existsSync(join(dir, "varbittypes.txt"))) return dir;
    }
  }
  throw new Error("could not locate the OSRS data dir; set OSRS_DATA_DIR to mcp-osrs/dist/data.");
}

const repo = process.env.GOAL_PLANNER_REPO || resolve(here, "..", "..", "runelite-goal-planner");
const diarySrc = join(repo, "src/main/java/com/goalplanner/data/AchievementDiaryData.java");
const java = readFileSync(diarySrc, "utf8");

// varbit cache name (lowercase) → numeric id, from the OSRS data.
const varbitName2Id = new Map();
const varbitFile = join(findOsrsDataDir(), "varbittypes.txt");
for (const line of readFileSync(varbitFile, "utf8").split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const id = Number.parseInt(line.slice(0, tab), 10);
  const name = line.slice(tab + 1).trim().toLowerCase();
  if (Number.isInteger(id) && name && !varbitName2Id.has(name)) varbitName2Id.set(name, id);
}

const resolveVarbit = (constName) => {
  const id = varbitName2Id.get(constName.toLowerCase());
  if (id === undefined) throw new Error(`varbit constant ${constName} not found in OSRS varbittypes.txt`);
  return id;
};

// (area, tier) → { varbitId, requiredValue }
const entries = [];

// Boolean COMPLETE varbits: put("AREA", Tier.X, VarbitID.CONST);
for (const m of java.matchAll(/put\(\s*"(\w+)"\s*,\s*Tier\.(\w+)\s*,\s*VarbitID\.(\w+)\s*\)/g)) {
  entries.push({ area: m[1], tier: m[2], varbitId: resolveVarbit(m[3]), requiredValue: 1 });
}
// Karamja COUNT varbits: KARAMJA_COUNT_VARBITS.put(Tier.X, new Tracking(VarbitID.CONST, N));
for (const m of java.matchAll(/KARAMJA_COUNT_VARBITS\.put\(\s*Tier\.(\w+)\s*,\s*new Tracking\(\s*VarbitID\.(\w+)\s*,\s*(\d+)\s*\)/g)) {
  entries.push({ area: "KARAMJA", tier: m[1], varbitId: resolveVarbit(m[2]), requiredValue: Number.parseInt(m[3], 10) });
}

if (entries.length === 0) throw new Error(`no diary entries parsed from ${diarySrc}`);

// Sort by area then tier order for a stable, readable table.
const TIER_ORDER = { EASY: 0, MEDIUM: 1, HARD: 2, ELITE: 3 };
entries.sort((a, b) => a.area.localeCompare(b.area) || TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

const rows = entries
  .map((e) => `  ["${e.area}|${e.tier}", { varbitId: ${e.varbitId}, targetValue: ${e.requiredValue} }],`)
  .join("\n");

const areas = [...new Set(entries.map((e) => e.area))];
const content = `/**
 * Achievement-diary reference data — "(AREA|TIER)" → { varbitId, targetValue }.
 * A DIARY goal tracks by varbit: the recipient's DiaryTracker reads
 * \`getVarbitValue(varbitId)\` and treats it complete at \`targetValue\` (1 for
 * boolean COMPLETE varbits; the tier task count for Karamja Easy/Medium/Hard).
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:diaries\`
 * (see scripts/gen-diaries.mjs). Joins the plugin's AchievementDiaryData.java
 * structure with numeric ids from the OSRS cache varbittypes.txt.
 * Areas (${areas.length}): ${areas.join(", ")}. ${entries.length} (area, tier) entries.
 */

export interface DiaryTracking {
  varbitId: number;
  targetValue: number;
}

export const DIARY_TRACKING: ReadonlyArray<readonly [string, DiaryTracking]> = [
${rows}
];
`;

const out = join(here, "..", "src", "refdata", "diaries.data.ts");
writeFileSync(out, content);
console.log(`wrote ${out} with ${entries.length} diary entries across ${areas.length} areas`);
