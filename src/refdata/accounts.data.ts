/**
 * Account-metric reference data — the plugin's `AccountMetric` enum constants.
 * The recipient's AccountTracker does `AccountMetric.valueOf(accountMetric)`,
 * so an ACCOUNT goal auto-tracks ONLY when `accountMetric` is the exact
 * CONSTANT name (e.g. "QUEST_POINTS"), never the display name. min/maxTarget
 * mirror the plugin's sensible-target range (used for warnings, not rejection).
 * Leagues-scoped metrics only track on seasonal worlds.
 *
 * GENERATED — do not hand-edit. Regenerate with `npm run gen:accounts` (reads
 * the plugin source via $GOAL_PLANNER_REPO; see scripts/gen-accounts.mjs).
 * Source: runelite-goal-planner AccountMetric.java (16 metrics).
 */

export interface AccountMetricRef {
  /** Plugin enum constant — the value `accountMetric` must carry on the wire. */
  enumName: string;
  /** Display name shown on the goal card. */
  displayName: string;
  /** Smallest sensible target (plugin UI minimum). */
  minTarget: number;
  /** Largest sensible target (plugin UI maximum, e.g. 333 quest points). */
  maxTarget: number;
  /** True for OSRS Leagues metrics — tracked only on seasonal worlds. */
  leagues: boolean;
}

export const ACCOUNT_METRICS: readonly AccountMetricRef[] = [
  { enumName: "QUEST_POINTS", displayName: "Quest Points", minTarget: 1, maxTarget: 339, leagues: false },
  { enumName: "COMBAT_LEVEL", displayName: "Combat Level", minTarget: 3, maxTarget: 126, leagues: false },
  { enumName: "TOTAL_LEVEL", displayName: "Total Level", minTarget: 1, maxTarget: 2376, leagues: false },
  { enumName: "CA_POINTS", displayName: "CA Points", minTarget: 1, maxTarget: 2630, leagues: false },
  { enumName: "SLAYER_POINTS", displayName: "Slayer Points", minTarget: 1, maxTarget: 64000, leagues: false },
  { enumName: "KUDOS", displayName: "Museum Kudos", minTarget: 1, maxTarget: 243, leagues: false },
  { enumName: "ATT_STR_COMBINED", displayName: "Att + Str", minTarget: 2, maxTarget: 198, leagues: false },
  { enumName: "MISC_APPROVAL", displayName: "Misc. Approval", minTarget: 1, maxTarget: 127, leagues: false },
  { enumName: "TOG_MAX_TEARS", displayName: "Tears of Guthix PB", minTarget: 1, maxTarget: 339, leagues: false },
  { enumName: "CHOMPY_KILLS", displayName: "Chompy Kills", minTarget: 1, maxTarget: 4000, leagues: false },
  { enumName: "COLOSSEUM_GLORY", displayName: "Colosseum Glory", minTarget: 1, maxTarget: 100000, leagues: false },
  { enumName: "DOM_DEEPEST_LEVEL", displayName: "DoM Deepest Level", minTarget: 1, maxTarget: 8, leagues: false },
  { enumName: "COLLECTION_LOG_SLOTS", displayName: "Collection Log Slots", minTarget: 1, maxTarget: 1701, leagues: false },
  { enumName: "DIARY_TIERS_COMPLETED", displayName: "Diary Tiers", minTarget: 1, maxTarget: 48, leagues: false },
  { enumName: "LEAGUE_POINTS", displayName: "League Points", minTarget: 1, maxTarget: 500000, leagues: true },
  { enumName: "LEAGUE_TASKS", displayName: "Leagues Tasks", minTarget: 1, maxTarget: 1500, leagues: true },
];

export const ACCOUNT_METRIC_COUNT = ACCOUNT_METRICS.length;
