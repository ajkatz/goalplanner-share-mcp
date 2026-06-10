// Regenerate src/refdata/accounts.data.ts from the plugin's AccountMetric.java.
//
// The plugin's AccountTracker does `AccountMetric.valueOf(goal.getAccountMetric())`,
// so an ACCOUNT goal auto-tracks ONLY when `accountMetric` is the exact plugin
// enum CONSTANT (e.g. QUEST_POINTS). Each constant's signature is
// NAME("Display", Color, spriteId, iconKey, minTarget, maxTarget) — we keep the
// display name and the min/max target range for validation. Leagues-scoped
// metrics (tracked only on seasonal worlds) are read from isLeagues()'s body.
//
// Usage: GOAL_PLANNER_REPO=/path/to/runelite-goal-planner npm run gen:accounts
// (defaults to ../runelite-goal-planner relative to this repo).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.env.GOAL_PLANNER_REPO || resolve(here, "..", "..", "runelite-goal-planner");
const src = join(repo, "src/main/java/com/goalplanner/model/AccountMetric.java");

let java = readFileSync(src, "utf8");

// Leagues-scoped constants from isLeagues(): `return this == A || this == B;`
const leaguesBody = java.match(/boolean isLeagues\(\)\s*\{([\s\S]*?)\}/);
const leagues = new Set(leaguesBody ? [...leaguesBody[1].matchAll(/this == (\w+)/g)].map((m) => m[1]) : []);

// Strip comments BEFORE finding the list terminator — doc comments contain
// semicolons that would otherwise truncate the constant list (cost us the two
// LEAGUE_* metrics on the first attempt).
const noComments = java
  .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
  .replace(/\/\/[^\n]*/g, ""); // line comments
const enumBody = noComments.match(/public enum AccountMetric\s*\{([\s\S]*?);/);
if (!enumBody) throw new Error(`couldn't locate the enum constant list in ${src}`);
const stripped = enumBody[1].replace(/\s+/g, " ");

// NAME("Display", <args with one level of nesting>) — min/max are the last two ints.
const metrics = [];
for (const m of stripped.matchAll(/(\w+)\(\s*"([^"]+)"((?:[^()"]|\([^()]*\)|"[^"]*")*)\)/g)) {
  const [, enumName, displayName, tail] = m;
  const flat = [...tail.matchAll(/(?<![\w."])\d+(?![\w."])/g)].map((x) => Number(x[0]));
  if (flat.length < 2) throw new Error(`couldn't read min/max targets for ${enumName} (tail: ${tail})`);
  metrics.push({
    enumName,
    displayName,
    minTarget: flat[flat.length - 2],
    maxTarget: flat[flat.length - 1],
    leagues: leagues.has(enumName),
  });
}
if (metrics.length < 10) throw new Error(`only ${metrics.length} metrics parsed — expected 14+, refusing to emit`);

const header = `/**
 * Account-metric reference data — the plugin's \`AccountMetric\` enum constants.
 * The recipient's AccountTracker does \`AccountMetric.valueOf(accountMetric)\`,
 * so an ACCOUNT goal auto-tracks ONLY when \`accountMetric\` is the exact
 * CONSTANT name (e.g. "QUEST_POINTS"), never the display name. min/maxTarget
 * mirror the plugin's sensible-target range (used for warnings, not rejection).
 * Leagues-scoped metrics only track on seasonal worlds.
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:accounts\` (reads
 * the plugin source via $GOAL_PLANNER_REPO; see scripts/gen-accounts.mjs).
 * Source: runelite-goal-planner AccountMetric.java (${metrics.length} metrics).
 */

export interface AccountMetricRef {
  /** Plugin enum constant — the value \`accountMetric\` must carry on the wire. */
  enumName: string;
  /** Display name shown on the goal card. */
  displayName: string;
  /** Smallest sensible target (plugin UI minimum). */
  minTarget: number;
  /** Largest sensible target (plugin UI maximum, e.g. 333 quest points). */
  maxTarget: number;
  /** True for OSRS Leagues metrics — tracked only on seasonal worlds. */
  leagues: boolean;
}

export const ACCOUNT_METRICS: readonly AccountMetricRef[] = [
`;
const body = metrics
  .map(
    (q) =>
      `  { enumName: ${JSON.stringify(q.enumName)}, displayName: ${JSON.stringify(q.displayName)}, minTarget: ${q.minTarget}, maxTarget: ${q.maxTarget}, leagues: ${q.leagues} },`,
  )
  .join("\n");
const file = `${header}${body}\n];\n\nexport const ACCOUNT_METRIC_COUNT = ACCOUNT_METRICS.length;\n`;
const dest = join(here, "..", "src/refdata/accounts.data.ts");
writeFileSync(dest, file);
console.log(`wrote ${dest}: ${metrics.length} metrics (${[...leagues].join(", ") || "no leagues"})`);
