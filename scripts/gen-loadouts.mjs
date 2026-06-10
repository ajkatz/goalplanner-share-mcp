// Regenerate src/refdata/loadouts.data.ts from the OSRS Wiki.
//
// HYBRID by design: the wiki's "Armour/Highest bonuses" page ranks each slot by
// raw bonus, which is correct for ARMOUR but wrong for WEAPONS (it picks slow,
// high-bonus weapons — Zombie axe, Black chinchompa, Kodai wand — over the real
// DPS best). So we take armour slots from the wiki (current: Amulet of rancour,
// Confliction gauntlets, …) and CURATE the weapon + cape per style. All three
// curated weapons are 2h, so the shield slot is dropped for coherence.
//
// Sources (fetched live; output is committed so builds stay offline):
//   - https://prices.runescape.wiki/api/v1/osrs/mapping  (display name → itemId)
//   - https://oldschool.runescape.wiki/api.php?action=parse (the bonus tables)
//
// Usage: npm run gen:loadouts   (needs network)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const UA = "goalplanner-share-mcp gen-loadouts (OSRS Goal Planner; local dev)";
const here = dirname(fileURLToPath(import.meta.url));

const fetchJson = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  return r.json();
};

const decodeEntities = (s) =>
  s
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

// --- objtypes codename → id, as a last-resort resolver for untradeables -----
function objtypesByCodename() {
  let dir = process.env.OSRS_DATA_DIR;
  if (!dir) {
    const npx = join(homedir(), ".npm", "_npx");
    if (existsSync(npx)) {
      for (const h of readdirSync(npx)) {
        const d = join(npx, h, "node_modules", "@jayarrowz", "mcp-osrs", "dist", "data");
        if (existsSync(join(d, "objtypes.txt"))) {
          dir = d;
          break;
        }
      }
    }
  }
  const map = new Map();
  if (!dir) return map;
  for (const line of readFileSync(join(dir, "objtypes.txt"), "utf8").split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const id = Number.parseInt(line.slice(0, tab), 10);
    const code = line.slice(tab + 1).trim();
    if (Number.isInteger(id) && code && !map.has(code)) map.set(code, id);
  }
  return map;
}

// Untradeable / category / disambiguation entries the wiki lists that the
// mapping API can't resolve — pinned to the goal-appropriate obtainable item.
const CURATED_OVERRIDES = {
  "infernal cape": { id: 21295, name: "Infernal cape" },
  "god capes": { id: 21793, name: "Imbued guthix cape" },
  "blessed dizana's quiver": { id: 22109, name: "Ava's assembler" },
};

// Curated 2h weapon per style (DPS best, not bonus best).
const CURATED_WEAPON = {
  melee: { id: 22325, name: "Scythe of vitur" },
  ranged: { id: 20997, name: "Twisted bow" },
  mage: { id: 27275, name: "Tumeken's shadow" },
};

// Wiki section anchor + slot order per style. Weapon/Ammo/Shield excluded
// (weapon curated; 2h weapon ⇒ no shield).
const STYLES = [
  { key: "maxed melee", name: "Maxed melee", style: "melee", anchor: "Strength" },
  { key: "maxed ranged", name: "Maxed ranged", style: "ranged", anchor: "Ranged_strength" },
  { key: "maxed mage", name: "Maxed mage", style: "mage", anchor: "Magic_damage" },
];
const ARMOUR_SLOTS = ["Head", "Cape", "Neck", "Body", "Legs", "Hands", "Feet", "Ring"];

const sectionTable = (html, anchor) => {
  const i = html.indexOf(`id="${anchor}"`);
  if (i < 0) return "";
  const t = html.indexOf("<table", i);
  return html.slice(t, html.indexOf("</table>", t));
};

const parseSlotItems = (table) => {
  const bySlot = new Map();
  for (const tr of table.split("<tr>").slice(1)) {
    const slot = (tr.match(/Worn_Equipment#(\w+?)_slot/) || [])[1];
    const item = (tr.match(/plinkt-link"><a href="\/w\/[^"]+" title="([^"]+)"/) || [])[1];
    if (slot && item && !bySlot.has(slot)) bySlot.set(slot, decodeEntities(item));
  }
  return bySlot;
};

const main = async () => {
  const mapping = await fetchJson("https://prices.runescape.wiki/api/v1/osrs/mapping");
  const byName = new Map(mapping.map((m) => [m.name.toLowerCase(), m.id]));
  const byCode = objtypesByCodename();
  const parsed = await fetchJson(
    "https://oldschool.runescape.wiki/api.php?action=parse&page=Armour/Highest_bonuses&prop=text&format=json",
  );
  const html = parsed.parse.text["*"];

  const warnings = [];
  const resolveName = (raw) => {
    const name = decodeEntities(raw);
    const lower = name.toLowerCase();
    if (CURATED_OVERRIDES[lower]) return CURATED_OVERRIDES[lower];
    const stripped = lower.replace(/\s*\([^)]*\)\s*$/, "").trim(); // drop "(max)"/"(f)" suffix
    const id = byName.get(lower) ?? byName.get(stripped) ?? byCode.get(stripped.replace(/[^a-z0-9]+/g, "_"));
    if (id) return { id, name: byName.has(lower) ? name : stripped.replace(/\b\w/, (c) => c.toUpperCase()) };
    return null;
  };

  const loadouts = [];
  for (const s of STYLES) {
    const bySlot = parseSlotItems(sectionTable(html, s.anchor));
    const members = [];
    for (const slot of ARMOUR_SLOTS) {
      const raw = bySlot.get(slot);
      if (!raw) continue;
      const r = resolveName(raw);
      if (r) members.push(r);
      else warnings.push(`${s.key}: couldn't resolve ${slot} item "${raw}" — slot skipped.`);
    }
    members.push(CURATED_WEAPON[s.style]); // curated 2h weapon
    loadouts.push({ ...s, members });
  }

  const rows = loadouts
    .map((l) => {
      const mem = l.members.map((m) => `      member(${m.id}, ${JSON.stringify(m.name)}),`).join("\n");
      return `  ["${l.key}", { name: ${JSON.stringify(l.name)}, members: [\n${mem}\n    ] }],`;
    })
    .join("\n");

  const content = `/**
 * BiS loadout presets by combat style — HYBRID source: armour slots are taken
 * from the OSRS Wiki "Armour/Highest bonuses" tables (current — Amulet of
 * rancour, Confliction gauntlets, …); the weapon + cape are CURATED (the wiki
 * ranks weapons by raw bonus, which picks slow non-DPS weapons). All weapons are
 * 2h, so there is no shield slot.
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:loadouts\`
 * (see scripts/gen-loadouts.mjs; needs network). Member ids include items newer
 * than the objtypes snapshot, so refdata/items.ts treats loadout ids as known.
 */
import type { ItemSet } from "./items.js";

const member = (itemId: number, name: string) => ({ itemId, name, codename: "" });

export const LOADOUTS_DATA: ReadonlyArray<readonly [string, ItemSet]> = [
${rows}
];
`;

  const out = join(here, "..", "src", "refdata", "loadouts.data.ts");
  writeFileSync(out, content);
  console.log(`wrote ${out} with ${loadouts.length} loadouts (${loadouts.map((l) => l.members.length).join("/")} pieces)`);
  for (const w of warnings) console.log(`  ! ${w}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
