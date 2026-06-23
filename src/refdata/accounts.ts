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
  ttl: "TOTAL_LEVEL",
  totallvl: "TOTAL_LEVEL",
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
  collectionlog: "COLLECTION_LOG_SLOTS",
  collog: "COLLECTION_LOG_SLOTS",
  clog: "COLLECTION_LOG_SLOTS",
  clogslots: "COLLECTION_LOG_SLOTS",
  diaries: "DIARY_TIERS_COMPLETED",
  achievementdiaries: "DIARY_TIERS_COMPLETED",
  diarytiers: "DIARY_TIERS_COMPLETED",
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

/** A resolved metric plus the milestone the phrase itself implies. */
export interface AccountPhrase {
  metric: AccountMetricRef;
  /** Target implied by the phrase ("Elite CAs" → 1064); undefined = caller's choice. */
  impliedTarget?: number;
}

/** CA tier thresholds — mirrors the plugin's AccountMetric.CA_TIER_VALUES. */
export const CA_TIER_POINTS: Record<string, number> = {
  easy: 41,
  medium: 161,
  med: 161,
  hard: 416,
  elite: 1064,
  master: 1904,
  grandmaster: 2630,
  gm: 2630,
};

/** Phrase → (metric, implied target). Keys are key()-normalized. */
const PHRASES = new Map<string, { enumName: string; implied: (m: AccountMetricRef) => number }>();
for (const [tier, points] of Object.entries(CA_TIER_POINTS)) {
  for (const suffix of ["cas", "ca", "combatachievements", "combatachievementstier", "combatachievementtier"]) {
    PHRASES.set(`${tier}${suffix}`, { enumName: "CA_POINTS", implied: () => points });
  }
}
for (const k of ["questcape", "questpointcape", "maintainquestcape"]) {
  PHRASES.set(k, { enumName: "QUEST_POINTS", implied: (m) => m.maxTarget });
}
for (const k of ["max", "maxing", "maxttl", "maxtotal", "maxtotallevel", "maxedaccount"]) {
  PHRASES.set(k, { enumName: "TOTAL_LEVEL", implied: (m) => m.maxTarget });
}
for (const k of ["diarycape", "achievementdiarycape", "achievementcape"]) {
  PHRASES.set(k, { enumName: "DIARY_TIERS_COMPLETED", implied: (m) => m.maxTarget });
}

/** Leading goal-verbs players prefix phrases with ("Reach Elite CAs", "get to 2k total"). */
const LEAD_VERBS = ["reachthe", "reach", "getto", "getcloserto", "get", "become", "hit", "obtain", "earn", "actuallydo"];
const stripVerb = (k: string): string => {
  for (const v of LEAD_VERBS) {
    if (k.startsWith(v) && k.length > v.length + 1) return k.slice(v.length);
  }
  return k;
};

/**
 * Resolve a metric NAME OR PHRASE. Phrases can imply their own milestone
 * ("Elite CAs" → CA_POINTS @ 1064; "quest cape" → QUEST_POINTS @ max); plain
 * metric names resolve with no implied target.
 */
export function resolveAccountPhrase(name: string | undefined): AccountPhrase | null {
  const raw = (name ?? "").trim();
  if (!raw) return null;
  for (const k of [key(raw), stripVerb(key(raw))]) {
    const hit = PHRASES.get(k);
    if (hit) {
      const metric = BY_ENUM.get(hit.enumName);
      if (metric) return { metric, impliedTarget: hit.implied(metric) };
    }
  }
  const metric = resolveAccountMetric(raw) ?? resolveAccountMetric(stripVerb(key(raw)));
  return metric ? { metric } : null;
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
