// Regenerate src/refdata/item-sources.data.ts from the plugin's
// `item-sources.tsv` resource (`itemId <tab> label <tab> TagCategory`), the
// OSRS-Wiki-derived Collection Log source map the plugin uses to auto-seed
// source tags on in-game item goals. Vendoring it here lets the crafter emit
// the SAME source tags on ITEM_GRIND goals, so an imported "Pegasian crystal"
// arrives tagged "Cerberus" exactly as if added from the collection log.
//
// Usage: PLUGIN_DIR=/path/to/runelite-goal-planner npm run gen:item-sources
// If PLUGIN_DIR is unset, defaults to ../runelite-goal-planner beside this repo.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const pluginDir = process.env.PLUGIN_DIR || join(here, "..", "..", "runelite-goal-planner");
const src = join(pluginDir, "src", "main", "resources", "com", "goalplanner", "data", "item-sources.tsv");
if (!existsSync(src)) {
  throw new Error(
    `could not find item-sources.tsv at ${src}. Set PLUGIN_DIR to the runelite-goal-planner checkout.`,
  );
}

// Mirror the plugin's TagCategory enum — any label outside this set is a sign
// the enum drifted and the crafter would emit a tag the importer drops.
const CATEGORIES = new Set(["BOSS", "RAID", "CLUE", "MINIGAME", "SKILLING", "QUEST", "OTHER"]);

const raw = readFileSync(src, "utf8");
const lines = [];
let bad = 0;
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  const parts = line.split("\t");
  if (parts.length !== 3) {
    bad++;
    continue;
  }
  const [idStr, label, category] = parts;
  const id = Number.parseInt(idStr, 10);
  if (!Number.isInteger(id) || !label || !CATEGORIES.has(category)) {
    bad++;
    continue;
  }
  lines.push(`${id}\t${label}\t${category}`);
}

if (lines.length === 0) throw new Error(`no rows parsed from ${src}`);

const packed = lines.join("\n");
const out = join(here, "..", "src", "refdata", "item-sources.data.ts");
const content = `/**
 * Item source map — \`itemId → (sourceLabel, TagCategory)\`, the OSRS-Wiki
 * Collection Log drop-source table the plugin ships as \`item-sources.tsv\` and
 * uses to auto-seed source tags on item goals. Vendored so the crafter emits
 * the SAME tags: an ITEM_GRIND goal for a collection-log item carries its
 * boss/raid/clue/minigame source tag, matching an in-game collection-log add.
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:item-sources\`
 * (see scripts/gen-item-sources.mjs). Source: the plugin's item-sources.tsv
 * (${lines.length} rows). One \`id<TAB>label<TAB>category\` per line; an item
 * may have several rows (multiple sources).
 */

export const PACKED_ITEM_SOURCES = \`${packed}\`;
`;

writeFileSync(out, content);
console.log(`wrote ${out} with ${lines.length} source rows (skipped ${bad} malformed) from ${src}`);
