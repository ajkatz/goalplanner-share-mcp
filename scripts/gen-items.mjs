// Regenerate src/refdata/items.data.ts from the OSRS cache `objtypes.txt`
// (id <tab> internal_codename), shipped by the JayArrowz mcp-osrs server.
//
// Usage: OSRS_DATA_DIR=/path/to/mcp-osrs/dist/data npm run gen:items
// If OSRS_DATA_DIR is unset, the script auto-discovers the npx-installed
// mcp-osrs data dir under ~/.npm/_npx/*/node_modules/@jayarrowz/mcp-osrs/dist/data.
//
// Variant filtering: bank placeholders (`placeholder_*`) and noted certificates
// (`cert_*`) are dropped — the plugin's ItemTracker counts an EXACT itemId, and
// those carry separate ids that players don't bank as the base item. Unused slots
// (name "null"/empty) are dropped. Everything else (incl. _lava/_ice/_t variants)
// is kept; the base codename wins an exact-name match, variants only match when the
// user spells the suffix out.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));

function findDataDir() {
  if (process.env.OSRS_DATA_DIR) return process.env.OSRS_DATA_DIR;
  const npx = join(homedir(), ".npm", "_npx");
  if (existsSync(npx)) {
    for (const hash of readdirSync(npx)) {
      const dir = join(npx, hash, "node_modules", "@jayarrowz", "mcp-osrs", "dist", "data");
      if (existsSync(join(dir, "objtypes.txt"))) return dir;
    }
  }
  throw new Error(
    "could not locate the OSRS data dir. Install the mcp-osrs server (it caches under " +
      "~/.npm/_npx/...) or set OSRS_DATA_DIR to its dist/data folder.",
  );
}

const dataDir = findDataDir();
const src = join(dataDir, "objtypes.txt");
const raw = readFileSync(src, "utf8");

/** @type {Map<string, number>} codename → first (lowest) itemId */
const byCodename = new Map();
let dropped = 0;
let dupes = 0;

for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const id = Number.parseInt(line.slice(0, tab), 10);
  const codename = line.slice(tab + 1).trim();
  if (!Number.isInteger(id)) continue;
  if (!codename || codename === "null") {
    dropped++;
    continue;
  }
  if (codename.startsWith("placeholder_") || codename.startsWith("cert_")) {
    dropped++;
    continue;
  }
  if (byCodename.has(codename)) {
    dupes++;
    continue; // keep the lowest id (file is id-ordered)
  }
  byCodename.set(codename, id);
}

if (byCodename.size === 0) throw new Error(`no items parsed from ${src}`);

// Pack as "id\tcodename" lines, id-ascending — compact + diff-friendly.
const packed = [...byCodename.entries()]
  .sort((a, b) => a[1] - b[1])
  .map(([codename, id]) => `${id}\t${codename}`)
  .join("\n");

const out = join(here, "..", "src", "refdata", "items.data.ts");
const content = `/**
 * Item reference data — \`itemId → internal codename\` for every real OSRS item,
 * from the OSRS cache \`objtypes.txt\` (JayArrowz mcp-osrs). Bank placeholders
 * (\`placeholder_*\`) and noted certs (\`cert_*\`) are filtered out; the plugin's
 * ItemTracker counts an EXACT itemId, so an ITEM_GRIND goal must carry the base
 * tradeable id.
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:items\`
 * (see scripts/gen-items.mjs). Source: objtypes.txt (${byCodename.size} items).
 *
 * Packed as one \`id<TAB>codename\` per line; refdata/items.ts builds the lookup
 * indexes from this once at module load.
 */

export const PACKED_ITEMS = \`${packed}\`;
`;

writeFileSync(out, content);
console.log(
  `wrote ${out} with ${byCodename.size} items (dropped ${dropped} placeholder/cert/null, ${dupes} dup codenames) from ${src}`,
);
