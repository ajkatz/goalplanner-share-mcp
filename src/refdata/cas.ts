/**
 * Combat-achievement name resolution over the generated wiki corpus
 * (cas.data.ts). The wire value is the in-game task id (caTaskId, bit 0–639)
 * — see CombatAchievementTracker's bit-packed varplayer read. Sprite/
 * description helpers mirror what the plugin's own CA creation paths set, so
 * imported goals look identical to in-game-created ones.
 */
import { CAS, type CaRef } from "./cas.data.js";

export { CAS, CA_COUNT } from "./cas.data.js";
export type { CaRef } from "./cas.data.js";

/** Highest valid task id — 20 CA_TASK_COMPLETED varplayers × 32 bits. */
export const CA_MAX_TASK_ID = 639;

/** Plugin parity: SpriteID.CaTierSwordsSmall._0.._5 = 3399..3404. */
const TIER_ORDER = ["Easy", "Medium", "Hard", "Elite", "Master", "Grandmaster"];
export function caTierSprite(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx >= 0 ? 3399 + idx : 0;
}

/** Normalize to a lookup key: lowercase, strip non-alphanumerics. */
const key = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const BY_ID = new Map<number, CaRef>(CAS.map((c) => [c.caTaskId, c]));
const BY_KEY = new Map<string, CaRef>();
for (const c of CAS) {
  const k = key(c.name);
  if (!BY_KEY.has(k)) BY_KEY.set(k, c);
}

/** Validate an explicit task id against the corpus. */
export function isKnownCaTaskId(id: number | undefined): CaRef | null {
  return id === undefined ? null : (BY_ID.get(id) ?? null);
}

/** Resolve a user-supplied task name to its CaRef, or null. */
export function resolveCa(name: string | undefined): CaRef | null {
  const k = key((name ?? "").trim());
  if (!k) return null;
  return BY_KEY.get(k) ?? null;
}

/**
 * Token-based suggestions for did-you-mean warnings. Matches against task AND
 * monster names — tokens degrade from the tail ("fo" stays, "noxious fo"
 * still hits "Noxious Foe") so typos suggest.
 */
export function searchCas(name: string | undefined, limit: number): CaRef[] {
  const tokens = (name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const tokenHits = (k: string, t: string): boolean => {
    for (let n = t.length; n >= Math.max(2, t.length - 2); n--) {
      if (k.includes(t.slice(0, n))) return true;
    }
    return false;
  };

  const out: CaRef[] = [];
  for (const c of CAS) {
    const k = key(c.name) + key(c.monster ?? "");
    if (tokens.every((t) => tokenHits(k, t))) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
