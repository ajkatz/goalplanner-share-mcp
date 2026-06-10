/**
 * Achievement-diary resolver. A DIARY goal tracks by `varbitId` + `targetValue`
 * (the recipient's DiaryTracker reads `getVarbitValue(varbitId)` and is complete
 * at `targetValue`). We resolve a user-supplied name like "Ardougne Elite" or
 * "Varrock hard diary" to the (area, tier) entry in {@link DIARY_TRACKING}.
 */
import { DIARY_TRACKING, type DiaryTracking } from "./diaries.data.js";

export interface DiaryMatch extends DiaryTracking {
  area: string; // canonical UPPER area key
  tier: string; // EASY | MEDIUM | HARD | ELITE
  /** Display name, e.g. "Ardougne Elite Diary". */
  name: string;
}

const byKey = new Map<string, DiaryTracking>(DIARY_TRACKING.map(([k, v]) => [k, v]));
const byVarbit = new Map<number, string>(DIARY_TRACKING.map(([k, v]) => [v.varbitId, k]));

/** Canonical area key → display name. */
const AREA_DISPLAY: Record<string, string> = {
  ARDOUGNE: "Ardougne",
  DESERT: "Desert",
  FALADOR: "Falador",
  FREMENNIK: "Fremennik",
  KANDARIN: "Kandarin",
  KARAMJA: "Karamja",
  KOUREND: "Kourend",
  LUMBRIDGE: "Lumbridge",
  MORYTANIA: "Morytania",
  VARROCK: "Varrock",
  WESTERN: "Western",
  WILDERNESS: "Wilderness",
};

/** Substrings that map an input to a canonical area key (checked longest-first). */
const AREA_ALIASES: Record<string, string> = {
  ardougne: "ARDOUGNE",
  "kharidian desert": "DESERT",
  desert: "DESERT",
  falador: "FALADOR",
  fremennik: "FREMENNIK",
  kandarin: "KANDARIN",
  karamja: "KARAMJA",
  "kourend & kebos": "KOUREND",
  "kourend and kebos": "KOUREND",
  "great kourend": "KOUREND",
  kourend: "KOUREND",
  kebos: "KOUREND",
  "lumbridge & draynor": "LUMBRIDGE",
  "lumbridge and draynor": "LUMBRIDGE",
  lumbridge: "LUMBRIDGE",
  draynor: "LUMBRIDGE",
  morytania: "MORYTANIA",
  varrock: "VARROCK",
  "western provinces": "WESTERN",
  western: "WESTERN",
  wilderness: "WILDERNESS",
};

const TIER_ALIASES: Record<string, string> = {
  easy: "EASY",
  medium: "MEDIUM",
  med: "MEDIUM",
  hard: "HARD",
  elite: "ELITE",
};

const diaryName = (area: string, tier: string): string =>
  `${AREA_DISPLAY[area] ?? area} ${tier.charAt(0) + tier.slice(1).toLowerCase()} Diary`;

const matchFor = (area: string, tier: string): DiaryMatch | null => {
  const t = byKey.get(`${area}|${tier}`);
  return t ? { ...t, area, tier, name: diaryName(area, tier) } : null;
};

/**
 * Resolve a free-text diary name to its (area, tier) tracking, or null. Order-
 * independent ("elite ardougne" works), tolerates "diary"/"achievement" noise and
 * area aliases ("Lumbridge & Draynor", "Western Provinces").
 */
export function resolveDiary(input: string | undefined): DiaryMatch | null {
  if (!input) return null;
  const text = input.toLowerCase().replace(/[^a-z0-9&\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  let tier: string | undefined;
  for (const [alias, canon] of Object.entries(TIER_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(text)) {
      tier = canon;
      break;
    }
  }
  if (!tier) return null;

  // Longest alias first so "kourend & kebos" wins over "kourend".
  let area: string | undefined;
  for (const alias of Object.keys(AREA_ALIASES).sort((a, b) => b.length - a.length)) {
    if (text.includes(alias)) {
      area = AREA_ALIASES[alias];
      break;
    }
  }
  if (!area) return null;

  return matchFor(area, tier);
}

/** Reverse lookup: a known diary varbit → its display name (for validating an explicit varbitId). */
export function diaryNameByVarbit(varbitId: number): string | null {
  const key = byVarbit.get(varbitId);
  if (!key) return null;
  const [area, tier] = key.split("|");
  return diaryName(area!, tier!);
}

/** True when `varbitId` is one of the tracked diary completion varbits. */
export function isKnownDiaryVarbit(varbitId: number): boolean {
  return byVarbit.has(varbitId);
}

/** Tracking for a known diary varbit (varbitId + targetValue), or null. */
export function diaryTrackingByVarbit(varbitId: number): DiaryMatch | null {
  const key = byVarbit.get(varbitId);
  if (!key) return null;
  const [area, tier] = key.split("|");
  return matchFor(area!, tier!);
}

export interface DiaryGroup {
  name: string;
  members: DiaryMatch[];
}

/**
 * Resolve an "all …" diary phrase to a group of (area, tier) entries, or null.
 * Requires an "all"/"every" trigger so single diaries still route to
 * {@link resolveDiary}. An optional tier and/or area narrow the set:
 *   "all elite diaries" → 12 · "all Ardougne diaries" → 4 · "all diaries" → 48.
 */
export function resolveDiaryGroup(input: string | undefined): DiaryGroup | null {
  if (!input) return null;
  const text = input.toLowerCase().replace(/[^a-z0-9&\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!/\b(all|every)\b/.test(text)) return null;

  let tier: string | undefined;
  for (const [alias, canon] of Object.entries(TIER_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(text)) {
      tier = canon;
      break;
    }
  }
  let area: string | undefined;
  for (const alias of Object.keys(AREA_ALIASES).sort((a, b) => b.length - a.length)) {
    if (text.includes(alias)) {
      area = AREA_ALIASES[alias];
      break;
    }
  }

  const members: DiaryMatch[] = [];
  for (const [key, t] of DIARY_TRACKING) {
    const [a, ti] = key.split("|");
    if ((area && a !== area) || (tier && ti !== tier)) continue;
    members.push({ ...t, area: a!, tier: ti!, name: diaryName(a!, ti!) });
  }
  if (members.length === 0) return null;

  const tierLabel = tier ? `${tier.charAt(0)}${tier.slice(1).toLowerCase()} ` : "";
  const areaLabel = area ? `${AREA_DISPLAY[area]} ` : "";
  return { name: `All ${areaLabel}${tierLabel}diaries`.replace(/\s+/g, " "), members };
}

export const DIARY_COUNT = byKey.size;
export const DIARY_AREAS: string[] = Object.values(AREA_DISPLAY);
