// Regenerate src/refdata/item-names.data.ts from the OSRS Wiki prices mapping.
//
// The objtypes table gives id ↔ internal CODENAME; display names only existed
// as curated aliases. This adds an authoritative DISPLAY-NAME layer for every
// tradeable item (~4k): https://prices.runescape.wiki/api/v1/osrs/mapping is
// the same endpoint gen-loadouts already uses to resolve names → ids.
// Untradeables (quivers, ornament-kit products, pets) stay alias-territory.
//
// Sources (fetched live; output is committed so builds stay offline):
//   https://prices.runescape.wiki/api/v1/osrs/mapping
//
// Usage: npm run gen:item-names
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const res = await fetch("https://prices.runescape.wiki/api/v1/osrs/mapping", {
  headers: { "User-Agent": "goalplanner-share-mcp gen:item-names (dev tool)" },
});
if (!res.ok) throw new Error(`prices mapping API HTTP ${res.status}`);
const rows = await res.json();
if (!Array.isArray(rows)) throw new Error("unexpected response shape");

const entries = [];
for (const r of rows) {
  const id = Number(r.id);
  const name = String(r.name ?? "").trim();
  if (!Number.isInteger(id) || id < 0 || !name) continue;
  entries.push([id, name]);
}
if (entries.length < 3000) throw new Error(`only ${entries.length} mapping rows — expected 4k+, refusing to emit`);
entries.sort((a, b) => a[0] - b[0]);

const packed = entries.map(([id, name]) => `${id}\t${name}`).join("\n");
const file = `/**
 * Item DISPLAY names — OSRS Wiki prices mapping (tradeable items). Packed as
 * "id<TAB>Display name" lines. Complements the codename table in
 * items.data.ts: codenames cover resolution for items whose codename matches
 * their display name; this layer covers the divergent tail authoritatively
 * (Armadyl crossbow, Amulet of torture, Voidwaker blade, …).
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:item-names\`
 * (fetches the wiki prices mapping; see scripts/gen-item-names.mjs).
 * Source: ${entries.length} tradeable items.
 */

export const PACKED_ITEM_NAMES = \`${packed.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\`;
`;
const dest = join(here, "..", "src/refdata/item-names.data.ts");
writeFileSync(dest, file);
console.log(`wrote ${dest}: ${entries.length} display names`);
