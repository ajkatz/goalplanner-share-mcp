// Regenerate src/refdata/cas.data.ts from the OSRS Wiki combat_achievement bucket.
//
// This is the SAME source the plugin itself uses (WikiCaRepository): the wiki
// bucket `id` is the in-game CA task id — the bit index (0–639) into the
// CA_TASK_COMPLETED varplayers that CombatAchievementTracker reads. The plugin
// validates ids against this table on import, so name + id pairs generated
// here stay in lock-step with what the recipient resolves.
//
// Sources (fetched live; output is committed so builds stay offline):
//   https://oldschool.runescape.wiki/api.php?action=bucket
//     query=bucket('combat_achievement').select('id','name','task','tier','monster','type')
//
// Usage: npm run gen:cas
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const BUCKET_QUERY = "bucket('combat_achievement').select('id','name','task','tier','monster','type').limit(5000).run()";
const url = new URL("https://oldschool.runescape.wiki/api.php");
url.searchParams.set("action", "bucket");
url.searchParams.set("format", "json");
url.searchParams.set("query", BUCKET_QUERY);

const res = await fetch(url, { headers: { "User-Agent": "goalplanner-share-mcp gen:cas (dev tool)" } });
if (!res.ok) throw new Error(`wiki bucket API HTTP ${res.status}`);
const json = await res.json();
const rows = json.bucket;
if (!Array.isArray(rows)) throw new Error(`unexpected response shape: ${JSON.stringify(json).slice(0, 200)}`);

const TIERS = new Set(["Easy", "Medium", "Hard", "Elite", "Master", "Grandmaster"]);
const seenIds = new Set();
const cas = [];
for (const r of rows) {
  const id = Number(r.id);
  const name = String(r.name ?? "").trim();
  const tier = String(r.tier ?? "").trim();
  if (!name || Number.isNaN(id)) throw new Error(`malformed row: ${JSON.stringify(r)}`);
  if (id < 0 || id > 639) throw new Error(`task id ${id} (${name}) outside the 0–639 varplayer bit range`);
  if (seenIds.has(id)) throw new Error(`duplicate task id ${id} (${name})`);
  seenIds.add(id);
  if (!TIERS.has(tier)) throw new Error(`unknown tier "${tier}" for ${name}`);
  cas.push({
    caTaskId: id,
    name,
    tier,
    monster: String(r.monster ?? "").trim() || null,
    type: String(r.type ?? "").trim() || null,
  });
}
if (cas.length < 500) throw new Error(`only ${cas.length} CA rows — expected 600+, refusing to emit`);
cas.sort((a, b) => a.caTaskId - b.caTaskId);

const tierCounts = {};
for (const c of cas) tierCounts[c.tier] = (tierCounts[c.tier] ?? 0) + 1;

const header = `/**
 * Combat-achievement reference data — OSRS Wiki \`combat_achievement\` bucket,
 * the SAME table the plugin's WikiCaRepository loads. \`caTaskId\` is the
 * in-game task id: the bit index (0–639) into the CA_TASK_COMPLETED
 * varplayers that the recipient's CombatAchievementTracker reads.
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:cas\` (fetches the
 * wiki bucket API; see scripts/gen-cas.mjs).
 * Source: ${cas.length} tasks (${Object.entries(tierCounts)
   .map(([t, n]) => `${t} ${n}`)
   .join(", ")}).
 */

export interface CaRef {
  /** In-game CA task id — the value \`caTaskId\` must carry on the wire (bit 0–639). */
  caTaskId: number;
  /** Task display name (e.g. "A Slow Death"). */
  name: string;
  /** Tier: Easy | Medium | Hard | Elite | Master | Grandmaster. */
  tier: string;
  /** Monster/encounter the task belongs to, when the wiki records one. */
  monster: string | null;
  /** Task category (Kill Count, Mechanical, Perfection, …). */
  type: string | null;
}

export const CAS: readonly CaRef[] = [
`;
const body = cas
  .map(
    (c) =>
      `  { caTaskId: ${c.caTaskId}, name: ${JSON.stringify(c.name)}, tier: ${JSON.stringify(c.tier)}, monster: ${JSON.stringify(c.monster)}, type: ${JSON.stringify(c.type)} },`,
  )
  .join("\n");
const file = `${header}${body}\n];\n\nexport const CA_COUNT = CAS.length;\n`;
const dest = join(here, "..", "src/refdata/cas.data.ts");
writeFileSync(dest, file);
console.log(
  `wrote ${dest}: ${cas.length} CA tasks (${Object.entries(tierCounts)
    .map(([t, n]) => `${t}: ${n}`)
    .join(", ")})`,
);
