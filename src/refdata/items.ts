/**
 * Item reference data + resolver. An ITEM_GRIND goal tracks by EXACT `itemId`
 * (the plugin's ItemTracker sums `item.getId() == itemId` across containers), so
 * the crafter must emit the precise base item id. We index the OSRS cache item
 * table (see {@link PACKED_ITEMS}, generated from `objtypes.txt`) by internal
 * codename and resolve user-supplied names against it.
 *
 * Most modern items' codenames ARE their display name with spaces → underscores
 * (`abyssal_whip`, `rune_platebody`, `magic_logs`), so normalization carries the
 * bulk. The divergent tail — old items and consumables whose codenames are pure
 * internal slugs (`mcannonball` = Cannonball, `4doseprayerrestore` = Prayer
 * potion(4)) — is covered by the curated {@link ALIASES} map, and beyond that by
 * the caller resolving an id via the OSRS Wiki and passing `itemId` explicitly.
 */
import { PACKED_ITEMS } from "./items.data.js";
import { LOADOUTS_DATA } from "./loadouts.data.js";

export interface ItemMatch {
  itemId: number;
  /** Display name for the preview (curated alias label, else prettified codename). */
  name: string;
  codename: string;
}

// id → codename, codename → id, and a loose (alphanumeric-only) key → ids index.
const byId = new Map<number, string>();
const byCodename = new Map<string, number>();
const byLoose = new Map<string, number[]>();

const looseKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

for (const line of PACKED_ITEMS.split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const id = Number.parseInt(line.slice(0, tab), 10);
  const codename = line.slice(tab + 1);
  if (!Number.isInteger(id) || !codename) continue;
  byId.set(id, codename);
  if (!byCodename.has(codename)) byCodename.set(codename, id);
  const lk = looseKey(codename);
  const bucket = byLoose.get(lk);
  if (bucket) bucket.push(id);
  else byLoose.set(lk, [id]);
}

/**
 * Curated display-name → itemId for items whose internal codename diverges from
 * the display name enough that normalization + loose matching can't bridge it —
 * consumables (codenames like `4dose…`) and collection-log pet NICKNAMES that
 * don't contain the boss name (`abyssalsire_pet` = "Abyssal orphan"). Names that
 * DO contain the boss/item (e.g. "Vorkath pet" → `vorkathpet`) already resolve by
 * loose match and need no entry. Every id here is cross-validated against the
 * objtypes corpus; the long tail is left to the caller (resolve via the OSRS Wiki
 * and pass an explicit `itemId`).
 */
const ALIASES: Record<string, { id: number; name: string }> = {
  cannonball: { id: 2, name: "Cannonball" },
  // Consumables (4-dose canonical).
  "prayer potion": { id: 2434, name: "Prayer potion(4)" },
  "prayer potion(4)": { id: 2434, name: "Prayer potion(4)" },
  "super combat potion": { id: 12695, name: "Super combat potion(4)" },
  "super combat potion(4)": { id: 12695, name: "Super combat potion(4)" },
  "saradomin brew": { id: 6685, name: "Saradomin brew(4)" },
  "saradomin brew(4)": { id: 6685, name: "Saradomin brew(4)" },
  "stamina potion": { id: 12625, name: "Stamina potion(4)" },
  "stamina potion(4)": { id: 12625, name: "Stamina potion(4)" },
  "ranging potion": { id: 2444, name: "Ranging potion(4)" },
  "super restore": { id: 3024, name: "Super restore(4)" },
  "super restore(4)": { id: 3024, name: "Super restore(4)" },
  "super attack": { id: 2436, name: "Super attack(4)" },
  "super attack(4)": { id: 2436, name: "Super attack(4)" },
  "super strength": { id: 2440, name: "Super strength(4)" },
  "super strength(4)": { id: 2440, name: "Super strength(4)" },
  "super defence": { id: 2442, name: "Super defence(4)" },
  "super defence(4)": { id: 2442, name: "Super defence(4)" },
  antipoison: { id: 2446, name: "Antipoison(4)" },
  "antipoison(4)": { id: 2446, name: "Antipoison(4)" },
  "bastion potion": { id: 22461, name: "Bastion potion(4)" },
  "bastion potion(4)": { id: 22461, name: "Bastion potion(4)" },
  // Collection-log pet nicknames (codename omits the boss name).
  "abyssal orphan": { id: 13262, name: "Abyssal orphan" },
  "ikkle hydra": { id: 22746, name: "Ikkle hydra" },
  vorki: { id: 21992, name: "Vorki" },
  "little nightmare": { id: 24491, name: "Little nightmare" },
  // Community weapon nicknames/abbreviations.
  bp: { id: 12924, name: "Toxic blowpipe" },
  blowpipe: { id: 12924, name: "Toxic blowpipe" },
  tbow: { id: 20997, name: "Twisted bow" },
  "t bow": { id: 20997, name: "Twisted bow" },
  shadow: { id: 27275, name: "Tumeken's shadow" },
  scythe: { id: 22325, name: "Scythe of vitur" },
  sang: { id: 22323, name: "Sanguinesti staff" },
  sanguinesti: { id: 22323, name: "Sanguinesti staff" },
};

/** Codename → sentence-case display ("abyssal_whip" → "Abyssal whip"). */
const prettify = (codename: string): string => {
  const spaced = codename.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : codename;
};

/** Look up the display name for a known itemId (for validating an explicit id). */
export function itemNameById(id: number): string | null {
  const codename = byId.get(id);
  if (codename) return prettify(codename);
  return CURATED_NAMES.get(id) ?? null;
}

/**
 * True when `id` is a real item we recognize: the objtypes corpus, OR a curated
 * set/loadout member (which may be newer than the objtypes snapshot, e.g.
 * wiki-sourced BiS items like Amulet of rancour).
 */
export function isKnownItemId(id: number): boolean {
  return byId.has(id) || CURATED_NAMES.has(id);
}

/**
 * Resolve a user-supplied item name to its base itemId + display name, or null
 * if unrecognized. Tries, in order: curated alias → exact normalized codename →
 * unambiguous loose (alphanumeric-only) match. A loose key that maps to more than
 * one item is treated as a miss (the caller should disambiguate, e.g. via wiki).
 */
export function resolveItem(input: string | undefined): ItemMatch | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  const alias = ALIASES[lower];
  if (alias) return { itemId: alias.id, name: alias.name, codename: byId.get(alias.id) ?? "" };

  // Codenames carry variant suffixes as underscores, not parens: display
  // "Bronze dart(p+)" → codename `bronze_dart_p+`, "Rune platebody(t)" → `..._t`.
  // Fold a trailing `(x)` into `_x` so those match exactly instead of going
  // ambiguous on the loose key.
  const codeKey = lower
    .replace(/['.]/g, "")
    .replace(/\(([^)]*)\)/g, (_full, inner: string) => (inner ? `_${inner}` : ""))
    .replace(/\s+/g, "_");
  const exact = byCodename.get(codeKey);
  if (exact !== undefined) return { itemId: exact, name: prettify(byId.get(exact)!), codename: byId.get(exact)! };

  const bucket = byLoose.get(looseKey(trimmed));
  if (bucket && bucket.length === 1) {
    const id = bucket[0]!;
    return { itemId: id, name: prettify(byId.get(id)!), codename: byId.get(id)! };
  }

  return null;
}

/**
 * Rank corpus items by how well their codename matches `query`, best first, for
 * suggesting candidates when {@link resolveItem} misses (ambiguous/unknown name).
 * Scoring: exact codename > prefix > all query tokens present as substrings.
 * Items matching none of the tokens are excluded. Ties break by lower itemId
 * (base forms tend to have lower ids than their variants).
 */
export function searchItems(query: string | undefined, limit = 8): ItemMatch[] {
  if (!query) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const key = looseKey(q);
  if (!key) return [];
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);

  const scored: { id: number; codename: string; score: number }[] = [];
  for (const [id, codename] of byId) {
    const lk = looseKey(codename);
    let score = 0;
    if (lk === key) score = 4;
    else if (lk.startsWith(key)) score = 3;
    else if (tokens.length > 0 && tokens.every((t) => lk.includes(t))) score = lk.includes(key) ? 2 : 1;
    if (score > 0) scored.push({ id, codename, score });
  }

  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  return scored.slice(0, limit).map(({ id, codename }) => ({ itemId: id, name: prettify(codename), codename }));
}

// --- Item sets ("full torva" → the pieces) ---------------------------------

export interface ItemSet {
  /** Display name of the set, e.g. "Torva". */
  name: string;
  members: ItemMatch[];
}

const member = (itemId: number, name: string): ItemMatch => ({ itemId, name, codename: byId.get(itemId) ?? "" });

/**
 * Curated armour/equipment sets. Members are stored by EXPLICIT itemId+display
 * (codenames diverge — "Torva full helm" is `torva_helm`), each verified against
 * the objtypes corpus. Keys are normalized (lowercase, "full"/"set"/"armour"
 * filler stripped) — see {@link resolveItemSet}.
 */
const ITEM_SETS: Record<string, ItemSet> = {
  torva: { name: "Torva", members: [member(26382, "Torva full helm"), member(26384, "Torva platebody"), member(26386, "Torva platelegs")] },
  masori: { name: "Masori", members: [member(27226, "Masori mask"), member(27229, "Masori body"), member(27232, "Masori chaps")] },
  "masori f": { name: "Masori (f)", members: [member(27235, "Masori mask (f)"), member(27238, "Masori body (f)"), member(27241, "Masori chaps (f)")] },
  bandos: { name: "Bandos", members: [member(11832, "Bandos chestplate"), member(11834, "Bandos tassets"), member(11836, "Bandos boots")] },
  armadyl: { name: "Armadyl", members: [member(11826, "Armadyl helmet"), member(11828, "Armadyl chestplate"), member(11830, "Armadyl chainskirt")] },
  ancestral: { name: "Ancestral", members: [member(21018, "Ancestral hat"), member(21021, "Ancestral robe top"), member(21024, "Ancestral robe bottom")] },
  justiciar: { name: "Justiciar", members: [member(22326, "Justiciar faceguard"), member(22327, "Justiciar chestguard"), member(22328, "Justiciar legguards")] },
  inquisitor: { name: "Inquisitor", members: [member(24419, "Inquisitor's great helm"), member(24420, "Inquisitor's hauberk"), member(24421, "Inquisitor's plateskirt")] },
};

// Extra spellings → canonical set key.
const SET_ALIASES: Record<string, string> = {
  "fortified masori": "masori f",
  "masori fortified": "masori f",
};

const setKey = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(full|set|armou?r|gear|equipment|setup|loadout|kit)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Resolve "full torva" / "masori armour" / "fortified masori" to its set, or null. */
export function resolveItemSet(input: string | undefined): ItemSet | null {
  if (!input) return null;
  const k = setKey(input);
  if (!k) return null;
  return ITEM_SETS[k] ?? ITEM_SETS[SET_ALIASES[k] ?? ""] ?? null;
}

// --- Loadout presets ("maxed melee" → a full BiS kit) -----------------------

/**
 * BiS loadouts by combat style. GENERATED from the OSRS Wiki (armour slots, kept
 * current) + curated weapon/cape — see {@link LOADOUTS_DATA} / gen-loadouts.mjs.
 * Opinionated by design; the preview lets the user drop/swap before confirming.
 */
const LOADOUTS: Record<string, ItemSet> = Object.fromEntries(LOADOUTS_DATA.map(([k, v]) => [k, v]));

// itemId → display name for every curated set/loadout member. Lets newer BiS
// items (not in the objtypes snapshot) still validate as known + display nicely.
const CURATED_NAMES = new Map<number, string>();
for (const grp of [...Object.values(ITEM_SETS), ...Object.values(LOADOUTS)]) {
  for (const m of grp.members) if (!CURATED_NAMES.has(m.itemId)) CURATED_NAMES.set(m.itemId, m.name);
}

// Extra spellings → canonical loadout key.
const LOADOUT_ALIASES: Record<string, string> = {
  "max melee": "maxed melee",
  "bis melee": "maxed melee",
  "maxed range": "maxed ranged",
  "max ranged": "maxed ranged",
  "max range": "maxed ranged",
  "bis ranged": "maxed ranged",
  "bis range": "maxed ranged",
  "maxed magic": "maxed mage",
  "max mage": "maxed mage",
  "max magic": "maxed mage",
  "bis mage": "maxed mage",
};

/** Resolve "maxed melee setup" / "bis range" to a loadout preset, or null. */
export function resolveLoadout(input: string | undefined): ItemSet | null {
  if (!input) return null;
  const k = setKey(input);
  if (!k) return null;
  return LOADOUTS[k] ?? LOADOUTS[LOADOUT_ALIASES[k] ?? ""] ?? null;
}

/** Resolve a name to either a curated armour set or a loadout preset. */
export function resolveItemGroup(input: string | undefined): ItemSet | null {
  return resolveItemSet(input) ?? resolveLoadout(input);
}

/**
 * Resolve a free-text equipment phrase into a flat, de-duplicated item list —
 * splitting on `+`, `&`, `,`, "and" — where each part may be a set ("full
 * masori" → 3 pieces) or a single item/nickname ("tbow"). Returns the resolved
 * items plus any parts that couldn't be resolved (for the caller to surface).
 */
export function resolveItemsPhrase(input: string | undefined): { items: ItemMatch[]; unresolved: string[] } {
  const items: ItemMatch[] = [];
  const unresolved: string[] = [];
  const seen = new Set<number>();
  if (!input) return { items, unresolved };

  const push = (m: ItemMatch) => {
    if (!seen.has(m.itemId)) {
      seen.add(m.itemId);
      items.push(m);
    }
  };

  for (const rawPart of input.split(/\s*(?:\+|&|,|\band\b|\bplus\b)\s*/i)) {
    const part = rawPart.trim();
    if (!part) continue;
    const group = resolveItemGroup(part);
    if (group) {
      group.members.forEach(push);
      continue;
    }
    const single = resolveItem(part);
    if (single) push(single);
    else unresolved.push(part);
  }
  return { items, unresolved };
}

/** True when an item phrase expands to a set or multiple items (i.e. should fan out into several goals). */
export function isMultiItemPhrase(input: string | undefined): boolean {
  if (!input) return false;
  if (resolveItemGroup(input)) return true;
  return /\s(?:\+|&|,|and|plus)\s|,/i.test(` ${input} `);
}

/** Total real items indexed — exposed for diagnostics/tests. */
export const ITEM_COUNT = byId.size;
