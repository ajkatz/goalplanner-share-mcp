/**
 * Wire types for the RuneLite Goal Planner share format, mirroring the plugin's
 * `com.goalplanner.share` DTOs (ShareBundle / GoalShareDto / TagShareDto). Field
 * names MUST match the Java side exactly — the plugin deserializes with Gson by
 * field name. Gson ignores unknown fields and fills missing ones with the DTO's
 * Java defaults, so our encoder may omit unset optionals; it must never emit
 * `null` for the list fields (requires/orRequires/tags), which the importer
 * iterates without a null check.
 */

/** Current share-format schema version (multi-section). */
export const SCHEMA_VERSION = 2 as const;

/** Legacy single-section schema version — still emitted for plain
 *  single-section bundles so older plugin builds import them. */
export const SCHEMA_VERSION_V1 = 1 as const;

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

/**
 * One section's worth of goals in a v2 bundle. Relation `ref` indices on the
 * contained goals are scoped to THIS section's goal list.
 */
export interface SectionShareDto {
  /** Section display name; omitted for loose goals / default-target. */
  name?: string;
  colorRgb: number; // -1 = default
  /** Land in the recipient's DEFAULT plan, reusing existing equivalents. */
  targetDefault?: boolean;
  /** Nested-view preference on import: true = force nested, false = force flat,
   *  omitted/undefined = recipient's global default. */
  nestedOverride?: boolean;
  goals: GoalShareDto[];
}

/**
 * One dependency edge between goals in two DIFFERENT sections of a v2 bundle.
 * Within a section, relations ride on each goal's section-scoped requires/
 * orRequires refs; edges that cross sections can't be expressed there, so the
 * bundle carries them as (section index, ref) → (section index, ref) pairs.
 * Section indices are positions in the bundle's `sections` list; refs are the
 * per-section goal refs. Mirrors the plugin's CrossEdgeDto.
 */
export interface CrossEdgeDto {
  /** Index of the dependent goal's section in the bundle's section list. */
  fromSection: number;
  /** The dependent goal's ref within its section. */
  fromRef: number;
  /** Index of the prerequisite goal's section in the bundle's section list. */
  toSection: number;
  /** The prerequisite goal's ref within its section. */
  toRef: number;
  /** True for an OR (any-of) edge; false for a hard requirement. */
  or: boolean;
}

export interface ShareBundle {
  v: number;
  kind: ShareKind;
  sharedBy?: string;
  sectionName?: string;
  sectionColorRgb: number; // -1 = default
  goals: GoalShareDto[];
  /** v2 payloads: one entry per shared section (absent on the v1 wire). */
  sections?: SectionShareDto[];
  /** v2 payloads: dependency edges between goals in DIFFERENT sections, which
   *  the per-section requires/orRequires refs cannot express. Absent on the v1
   *  wire and when no edges cross sections. */
  crossEdges?: CrossEdgeDto[];
}

/**
 * Version-neutral view: the v2 section list, or the legacy single-section
 * fields wrapped as one entry (mirrors the plugin's effectiveSections()).
 */
export function effectiveSections(bundle: ShareBundle): SectionShareDto[] {
  if (bundle.sections && bundle.sections.length > 0) return bundle.sections;
  const legacy: SectionShareDto = {
    colorRgb: bundle.sectionColorRgb ?? -1,
    goals: bundle.goals ?? [],
  };
  if (bundle.kind === "SECTION" && bundle.sectionName) legacy.name = bundle.sectionName;
  return [legacy];
}

/** True when the bundle needs the v2 wire (multi-section, default-target, or a
 *  nested-view preference - the v1 wire has nowhere to carry nestedOverride). */
export function needsV2(bundle: ShareBundle): boolean {
  const secs = effectiveSections(bundle);
  return (
    secs.length > 1 ||
    secs.some((s) => s.targetDefault === true || typeof s.nestedOverride === "boolean")
  );
}
