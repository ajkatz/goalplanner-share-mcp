/**
 * Item source tags. The plugin auto-seeds a source tag (the boss / raid / clue /
 * minigame an item drops from) on every collection-log item goal added in-game,
 * from its `item-sources.tsv` map. We vendor the same table ({@link
 * PACKED_ITEM_SOURCES}) so a crafted ITEM_GRIND goal carries the IDENTICAL tags:
 * the share wire already transports a goal's `tags`, and the importer
 * find-or-creates each as a system tag — so "Pegasian crystal" imports tagged
 * "Cerberus", exactly as if added from the collection log.
 *
 * Only collection-log items appear in the map; skilling-grind items (runes, etc.)
 * and non-clog drops resolve to no tags, which is correct — they get none in-game
 * either.
 */
import { PACKED_ITEM_SOURCES } from "./item-sources.data.js";

/** A source tag mirroring the plugin's ItemTag (label + TagCategory name). */
export interface SourceTag {
  label: string;
  category: string;
}

// itemId → its source tags. An item may drop from several sources (e.g. shared
// boss drops), so the value is a list, insertion-ordered as in the table.
const byId = new Map<number, SourceTag[]>();

for (const line of PACKED_ITEM_SOURCES.split("\n")) {
  const t1 = line.indexOf("\t");
  if (t1 < 0) continue;
  const t2 = line.indexOf("\t", t1 + 1);
  if (t2 < 0) continue;
  const id = Number.parseInt(line.slice(0, t1), 10);
  const label = line.slice(t1 + 1, t2);
  const category = line.slice(t2 + 1);
  if (!Number.isInteger(id) || !label || !category) continue;
  const bucket = byId.get(id);
  if (bucket) bucket.push({ label, category });
  else byId.set(id, [{ label, category }]);
}

/**
 * Source tags for an item, or an empty array if it isn't a tracked collection-log
 * drop. Returns a fresh array per call so callers can't mutate the shared table.
 */
export function getItemSourceTags(itemId: number | undefined): SourceTag[] {
  if (itemId === undefined) return [];
  const tags = byId.get(itemId);
  return tags ? tags.map((t) => ({ ...t })) : [];
}

/** Number of items with at least one source tag (diagnostic / tests). */
export const ITEM_SOURCE_COUNT = byId.size;
