/**
 * Quest name resolution over the generated RuneLite Quest enum corpus
 * (quests.data.ts). Resolution order: exact enum constant → normalized
 * display name (with/without leading "The") → curated alias → unique prefix.
 * The wire value is ALWAYS the enum constant — see QuestTracker's
 * Quest.valueOf(questName).
 */
import { QUESTS, type QuestRef } from "./quests.data.js";

export { QUESTS, QUEST_COUNT } from "./quests.data.js";
export type { QuestRef } from "./quests.data.js";

/** Trailing/embedded roman numerals players type as digits ("ds 2"). I–IV only:
 * wider conversion would mangle titles like "X Marks the Spot". */
const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };

/** Normalize to a lookup key: lowercase, & → and, roman→arabic per word, strip non-alphanumerics. */
const key = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w)
    .join("");

const dropThe = (k: string): string => (k.startsWith("the") && k.length > 6 ? k.slice(3) : k);

/**
 * Community abbreviations, individually verified against the generated corpus
 * (quests.test.ts asserts every target exists). Keys are key()-normalized.
 */
export const QUEST_ALIASES: Record<string, string> = {
  ds1: "DRAGON_SLAYER_I",
  ds2: "DRAGON_SLAYER_II",
  dt1: "DESERT_TREASURE_I",
  dt2: "DESERT_TREASURE_II__THE_FALLEN_EMPIRE",
  rfd: "RECIPE_FOR_DISASTER",
  mm1: "MONKEY_MADNESS_I",
  mm2: "MONKEY_MADNESS_II",
  mep1: "MOURNINGS_END_PART_I",
  mep2: "MOURNINGS_END_PART_II",
  sote: "SONG_OF_THE_ELVES",
  wgs: "WHILE_GUTHIX_SLEEPS",
  atoh: "A_TASTE_OF_HOPE",
  sins: "SINS_OF_THE_FATHER",
  barcrawl: "ALFRED_GRIMHANDS_BARCRAWL",
};

const BY_ENUM = new Map<string, QuestRef>(QUESTS.map((q) => [q.enumName, q]));

const BY_KEY = new Map<string, QuestRef>();
for (const q of QUESTS) {
  for (const k of new Set([key(q.displayName), dropThe(key(q.displayName)), key(q.enumName)])) {
    const prior = BY_KEY.get(k);
    // First writer wins; later collisions are dropped rather than shadowing
    // (the round-trip test fails loudly if a real quest loses its own key).
    if (!prior) BY_KEY.set(k, q);
  }
}

/** Exact enum-constant validation (case-insensitive). */
export function isKnownQuestEnum(name: string | undefined): QuestRef | null {
  const c = (name ?? "").trim().toUpperCase();
  return c ? (BY_ENUM.get(c) ?? null) : null;
}

/** Resolve any user-supplied quest name to its QuestRef, or null. */
export function resolveQuest(name: string | undefined): QuestRef | null {
  const raw = (name ?? "").trim();
  if (!raw) return null;

  const exact = isKnownQuestEnum(raw);
  if (exact) return exact;

  const k = key(raw);
  if (!k) return null;

  const direct = BY_KEY.get(k) ?? BY_KEY.get(dropThe(k));
  if (direct) return direct;

  const alias = QUEST_ALIASES[k];
  if (alias) return BY_ENUM.get(alias) ?? null;

  // Unique-prefix fallback ("desert treasure 2" → ...the fallen empire).
  if (k.length >= 4) {
    const hits = new Set<QuestRef>();
    for (const [candidate, q] of BY_KEY) {
      if (candidate.startsWith(k)) hits.add(q);
      if (hits.size > 1) return null;
    }
    if (hits.size === 1) return [...hits][0];
  }
  return null;
}

/**
 * Token-based suggestions for did-you-mean warnings. A quest matches when every
 * input token appears in its display key — tokens degrade from the tail
 * ("slayr" → "slay") so one-letter typos still suggest.
 */
export function searchQuests(name: string | undefined, limit: number): QuestRef[] {
  const tokens = (name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .map((t) => ROMAN[t] ?? t);
  if (tokens.length === 0) return [];

  const tokenHits = (k: string, t: string): boolean => {
    for (let n = t.length; n >= Math.max(3, t.length - 2); n--) {
      if (k.includes(t.slice(0, n))) return true;
    }
    return false;
  };

  const out: QuestRef[] = [];
  for (const q of QUESTS) {
    const k = key(q.displayName);
    if (tokens.every((t) => tokenHits(k, t))) {
      out.push(q);
      if (out.length >= limit) break;
    }
  }
  return out;
}
