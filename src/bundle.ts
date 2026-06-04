/**
 * Wire types for the RuneLite Goal Planner share format, mirroring the plugin's
 * `com.goalplanner.share` DTOs (ShareBundle / GoalShareDto / TagShareDto). Field
 * names MUST match the Java side exactly — the plugin deserializes with Gson by
 * field name. Gson ignores unknown fields and fills missing ones with the DTO's
 * Java defaults, so our encoder may omit unset optionals; it must never emit
 * `null` for the list fields (requires/orRequires/tags), which the importer
 * iterates without a null check.
 */

/** Current share-format schema version. The plugin rejects anything else. */
export const SCHEMA_VERSION = 1 as const;

/** GoalType enum names accepted by the plugin importer (unknown → goal skipped). */
export const GOAL_TYPES = [
  "SKILL",
  "QUEST",
  "DIARY",
  "COLLECTION_LOG",
  "ITEM_GRIND",
  "BOSS",
  "COMBAT_ACHIEVEMENT",
  "ACCOUNT",
  "CUSTOM",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** TagCategory enum names accepted by the plugin importer. */
export const TAG_CATEGORIES = ["SKILL", "QUEST", "BOSS", "DIARY", "ITEM", "CUSTOM", "SYSTEM"] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];

export type ShareKind = "SECTION" | "GOALS";

export interface TagShareDto {
  label: string;
  category: string;
  colorRgb: number; // -1 = default
  system: boolean;
}

export interface GoalShareDto {
  /** Bundle-local index used to wire requires/orRequires. */
  ref: number;
  type: string; // GoalType name
  name?: string;
  description?: string;
  targetValue?: number;

  // Type-specific references (only emit the ones relevant to `type`).
  skillName?: string;
  questName?: string;
  accountMetric?: string;
  bossName?: string;
  varbitId?: number;
  itemId?: number;
  spriteId?: number;
  tooltip?: string;
  caTaskId?: number; // DTO default -1
  customColorRgb?: number; // DTO default -1
  optional?: boolean;
  autoSeeded?: boolean;
  wikiUrl?: string;
  inventorySetup?: string;

  tags?: TagShareDto[];
  /** AND-prerequisite edges, as bundle-local ref indices. */
  requires?: number[];
  /** OR-prerequisite edges, as bundle-local ref indices. */
  orRequires?: number[];
}

export interface ShareBundle {
  v: number;
  kind: ShareKind;
  sharedBy?: string;
  sectionName?: string;
  sectionColorRgb: number; // -1 = default
  goals: GoalShareDto[];
}
