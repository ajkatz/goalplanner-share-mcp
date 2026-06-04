// Regenerate src/refdata/bosses.ts from the plugin's BossKillData.BOSSES map.
// Usage: GOAL_PLANNER_REPO=/path/to/runelite-goal-planner npm run gen:bosses
// (defaults to ../runelite-goal-planner relative to this repo).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.env.GOAL_PLANNER_REPO || resolve(here, "..", "..", "runelite-goal-planner");
const src = join(repo, "src/main/java/com/goalplanner/data/BossKillData.java");

const java = readFileSync(src, "utf8");
const names = [...java.matchAll(/BOSSES\.put\("([^"]+)"/g)].map((m) => m[1]);
if (names.length === 0) throw new Error(`no BOSSES.put entries found in ${src}`);

const header = `/**
 * Boss reference data — the exact boss names the plugin tracks, from
 * \`com.goalplanner.data.BossKillData.BOSSES\` (each maps to a kill-count
 * VarPlayer). A BOSS goal tracks by \`bossName\`, so the name must match one of
 * these verbatim for the recipient's plugin to count kills.
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:bosses\` (reads the
 * plugin source via $GOAL_PLANNER_REPO; see scripts/gen-bosses.mjs).
 * Source: runelite-goal-planner BossKillData.java (${names.length} bosses).
 */
`;

const body = `
export const BOSSES: readonly string[] = [
${names.map((n) => `  ${JSON.stringify(n)},`).join("\n")}
];

// Case-insensitive lookup → canonical boss name.
const BY_LOWER = new Map(BOSSES.map((b) => [b.toLowerCase(), b]));

/**
 * Resolve a user-supplied boss name to its canonical plugin name, or null if
 * unrecognized. Matches case-insensitively; also accepts a couple of common
 * aliases the plugin exposes via collection-log names.
 */
const ALIASES: Record<string, string> = {
  "the inferno": "TzKal-Zuk",
  inferno: "TzKal-Zuk",
  zuk: "TzKal-Zuk",
  "the fight caves": "TzTok-Jad",
  "fight caves": "TzTok-Jad",
  jad: "TzTok-Jad",
};

export function resolveBoss(input: string | undefined): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return BY_LOWER.get(key) ?? ALIASES[key] ?? null;
}
`;

const out = join(here, "..", "src/refdata/bosses.ts");
writeFileSync(out, header + body);
console.log(`wrote ${out} with ${names.length} bosses`);
