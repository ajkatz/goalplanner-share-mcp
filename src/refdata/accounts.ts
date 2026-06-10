/**
 * Account-metric name resolution over the generated AccountMetric corpus
 * (accounts.data.ts). Resolution order: exact enum constant → normalized
 * display name → curated alias → unique prefix. The wire value is ALWAYS the
 * plugin enum constant — see AccountTracker's AccountMetric.valueOf().
 */
import { ACCOUNT_METRICS, type AccountMetricRef } from "./accounts.data.js";

export { ACCOUNT_METRICS, ACCOUNT_METRIC_COUNT } from "./accounts.data.js";
export type { AccountMetricRef } from "./accounts.data.js";

/** Normalize to a lookup key: lowercase, & → and, strip non-alphanumerics. */
const key = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");

/**
 * Community shorthand, individually verified against the generated corpus
 * (accounts.test.ts asserts every target exists). Keys are key()-normalized.
 */
export const ACCOUNT_ALIASES: Record<string, string> = {
  qp: "QUEST_POINTS",
  questpoint: "QUEST_POINTS",
  combat: "COMBAT_LEVEL",
  cmb: "COMBAT_LEVEL",
  total: "TOTAL_LEVEL",
  kudos: "KUDOS",
  museumkudos: "KUDOS",
  capoints: "CA_POINTS",
  combatachievementpoints: "CA_POINTS",
  slayerpoints: "SLAYER_POINTS",
  attplusstr: "ATT_STR_COMBINED",
  attackstrength: "ATT_STR_COMBINED",
  miscellaniaapproval: "MISC_APPROVAL",
  kingdomapproval: "MISC_APPROVAL",
  tog: "TOG_MAX_TEARS",
  tearsofguthixpb: "TOG_MAX_TEARS",
  chompies: "CHOMPY_KILLS",
  chompybirdkills: "CHOMPY_KILLS",
  colosseum: "COLOSSEUM_GLORY",
  glory: "COLOSSEUM_GLORY",
  delvelevel: "DOM_DEEPEST_LEVEL",
  doomdeepestlevel: "DOM_DEEPEST_LEVEL",
  leaguepoints: "LEAGUE_POINTS",
  leaguestasks: "LEAGUE_TASKS",
  leaguetasks: "LEAGUE_TASKS",
};

const BY_ENUM = new Map<string, AccountMetricRef>(ACCOUNT_METRICS.map((m) => [m.enumName, m]));

const BY_KEY = new Map<string, AccountMetricRef>();
for (const m of ACCOUNT_METRICS) {
  for (const k of new Set([key(m.displayName), key(m.enumName)])) {
    if (!BY_KEY.has(k)) BY_KEY.set(k, m);
  }
}

/** Exact enum-constant validation (case-insensitive). */
export function isKnownAccountMetric(name: string | undefined): AccountMetricRef | null {
  const c = (name ?? "").trim().toUpperCase();
  return c ? (BY_ENUM.get(c) ?? null) : null;
}

/** Resolve any user-supplied metric name to its AccountMetricRef, or null. */
export function resolveAccountMetric(name: string | undefined): AccountMetricRef | null {
  const raw = (name ?? "").trim();
  if (!raw) return null;

  const exact = isKnownAccountMetric(raw);
  if (exact) return exact;

  const k = key(raw);
  if (!k) return null;

  const direct = BY_KEY.get(k);
  if (direct) return direct;

  const alias = ACCOUNT_ALIASES[k];
  if (alias) return BY_ENUM.get(alias) ?? null;

  // Unique-prefix fallback ("tears of guthix" → ...PB).
  if (k.length >= 3) {
    const hits = new Set<AccountMetricRef>();
    for (const [candidate, m] of BY_KEY) {
      if (candidate.startsWith(k)) hits.add(m);
      if (hits.size > 1) return null;
    }
    if (hits.size === 1) return [...hits][0];
  }
  return null;
}

/** Substring suggestions for did-you-mean warnings. */
export function searchAccountMetrics(name: string | undefined, limit: number): AccountMetricRef[] {
  const k = key(name ?? "");
  if (!k) return [];
  const out: AccountMetricRef[] = [];
  for (const m of ACCOUNT_METRICS) {
    if (key(m.displayName).includes(k) || key(m.enumName).includes(k)) {
      out.push(m);
      if (out.length >= limit) break;
    }
  }
  return out;
}
