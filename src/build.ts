/**
 * Spec → {@link ShareBundle} builder: the hybrid resolver. Recognized kinds
 * (Phase 1: SKILL, plus CUSTOM) become typed, auto-tracking goals; anything
 * else falls back to a CUSTOM goal (imports fine, never auto-tracks) unless the
 * caller supplies an explicit identifier, in which case it passes through as a
 * typed-but-unverified goal. Every fallback / drop is reported as a warning so
 * the calling assistant can reflect the true outcome back to the user before
 * confirming. Pure and side-effect free.
 */
import {
  type ShareBundle,
  type GoalShareDto,
  type GoalType,
  GOAL_TYPES,
  SCHEMA_VERSION,
} from "./bundle.js";
import { resolveSkill, xpForLevel, levelForXp, SKILLS, MAX_LEVEL } from "./refdata/skills.js";
import { resolveBoss } from "./refdata/bosses.js";
import { resolveBossGroup } from "./refdata/boss-groups.js";
import {
  resolveItem,
  itemNameById,
  isKnownItemId,
  searchItems,
  resolveItemGroup,
  resolveItemsPhrase,
  isMultiItemPhrase,
} from "./refdata/items.js";
import {
  resolveDiary,
  resolveDiaryGroup,
  diaryTrackingByVarbit,
  isKnownDiaryVarbit,
  DIARY_AREAS,
} from "./refdata/diaries.js";
import { resolveQuest, isKnownQuestEnum, searchQuests } from "./refdata/quests.js";
import {
  resolveAccountMetric,
  isKnownAccountMetric,
  searchAccountMetrics,
  type AccountMetricRef,
} from "./refdata/accounts.js";

/** GoalType → the label the plugin shows on a goal card. */
const TYPE_LABEL: Record<string, string> = {
  SKILL: "Skill",
  QUEST: "Quest",
  DIARY: "Diary",
  COLLECTION_LOG: "Collection Log",
  ITEM_GRIND: "Item",
  BOSS: "Boss",
  COMBAT_ACHIEVEMENT: "Combat Achievement",
  ACCOUNT: "Account",
  CUSTOM: "Custom",
};

const withCommas = (n: number): string => n.toLocaleString("en-US");

/** Kinds the typed core fully validates today (everything else → CUSTOM fallback). */
export const TYPED_CORE: GoalType[] = ["SKILL", "BOSS", "ITEM_GRIND", "DIARY", "QUEST", "ACCOUNT", "CUSTOM"];

export interface GoalSpec {
  /** Caller label used to wire requires/orRequires; defaults to the goal's index. */
  id?: string;
  /** "skill" | "custom" | any GoalType name (case-insensitive). */
  type: string;
  name?: string;
  description?: string;
  // SKILL
  skill?: string;
  level?: number;
  xp?: number;
  // CUSTOM / common
  tooltip?: string;
  colorRgb?: number;
  optional?: boolean;
  // explicit typed identifiers (passthrough / "raw" power use)
  skillName?: string;
  questName?: string;
  accountMetric?: string;
  bossName?: string;
  varbitId?: number;
  itemId?: number;
  spriteId?: number;
  caTaskId?: number;
  targetValue?: number;
  wikiUrl?: string;
  // tree edges (by id)
  requires?: string[];
  orRequires?: string[];
}

export interface ShareSpec {
  mode: "section" | "goals";
  sectionName?: string;
  sectionColorRgb?: number;
  sharedBy?: string;
  goals: GoalSpec[];
}

export interface ResolvedGoal {
  ref: number;
  id: string;
  type: GoalType;
  name: string;
  /** Short per-type target/identifier summary for the preview (e.g. "Level 90", "50 KC"). */
  detail: string;
  tracked: boolean;
  note?: string;
  requires: string[]; // resolved ids (AND)
  orRequires: string[]; // resolved ids (OR)
}

export interface BuildResult {
  bundle: ShareBundle;
  resolved: ResolvedGoal[];
  warnings: string[];
  preview: string;
}

const asGoalType = (s: string): GoalType | null => {
  const up = s.trim().toUpperCase();
  return (GOAL_TYPES as readonly string[]).includes(up) ? (up as GoalType) : null;
};

const isItemType = (t: string | undefined): boolean => {
  const r = (t ?? "").trim().toLowerCase();
  return r === "item" || r === "item_grind";
};

const subId = (id: string | undefined, k: number): string | undefined => (id ? `${id}#${k + 1}` : undefined);

/**
 * Pre-pass: fan a single "group" goal out into one goal per member, each carrying
 * an explicit identifier so it resolves verified. Covers ITEM sets/loadouts/
 * phrases ("full torva", "maxed melee", "masori + tbow"), BOSS groups ("GWD",
 * "all bosses"), and DIARY groups ("all elite diaries", "all Ardougne diaries").
 * Non-group goals — and goals where the caller already pinned an identifier —
 * pass through untouched.
 */
function expandGroupGoals(goals: GoalSpec[], warnings: string[]): GoalSpec[] {
  const out: GoalSpec[] = [];
  for (const g of goals) {
    const type = (g.type ?? "").trim().toLowerCase();

    // ITEM — sets / loadouts / "+"-phrases.
    if (isItemType(g.type) && g.name && (g.itemId === undefined || g.itemId <= 0) && isMultiItemPhrase(g.name)) {
      const { items, unresolved } = resolveItemsPhrase(g.name);
      if (items.length > 0) {
        items.forEach((m, k) => out.push({ ...g, name: m.name, itemId: m.itemId, id: subId(g.id, k) }));
        for (const u of unresolved) {
          warnings.push(`goal "${g.id ?? g.name}": couldn't resolve "${u}" within "${g.name}" — left out of the expansion.`);
        }
        const label = resolveItemGroup(g.name)?.name;
        if (label) warnings.push(`goal "${g.id ?? g.name}": expanded "${g.name}" into the ${items.length}-piece ${label}.`);
        continue;
      }
    }

    // BOSS — named collections ("GWD", "Dagannoth Kings", "all bosses").
    if ((type === "boss" || asGoalType(g.type) === "BOSS") && g.name && !g.bossName?.trim()) {
      const grp = resolveBossGroup(g.name);
      if (grp && grp.members.length > 0) {
        grp.members.forEach((b, k) => out.push({ ...g, name: b, bossName: b, id: subId(g.id, k) }));
        warnings.push(`goal "${g.id ?? g.name}": expanded "${g.name}" into ${grp.members.length} ${grp.name} boss goals.`);
        continue;
      }
    }

    // DIARY — "all …" tier/area collections.
    if ((type === "diary" || asGoalType(g.type) === "DIARY") && g.name && (g.varbitId === undefined || g.varbitId <= 0)) {
      const grp = resolveDiaryGroup(g.name);
      if (grp && grp.members.length > 0) {
        grp.members.forEach((m, k) =>
          out.push({ ...g, name: m.name, varbitId: m.varbitId, targetValue: m.targetValue, id: subId(g.id, k) }),
        );
        warnings.push(`goal "${g.id ?? g.name}": expanded "${g.name}" into ${grp.members.length} goals (${grp.name}).`);
        continue;
      }
    }

    out.push(g);
  }
  return out;
}

export function buildBundle(spec: ShareSpec): BuildResult {
  const warnings: string[] = [];
  const goals = expandGroupGoals(spec.goals ?? [], warnings);
  if (goals.length === 0) {
    warnings.push("no goals provided — the bundle would be empty and the plugin rejects empty imports.");
  }

  // id → ref index (ref is the goal's position). Caller ids must be unique;
  // duplicates keep the first and warn.
  const idToRef = new Map<string, number>();
  const ids: string[] = [];
  goals.forEach((g, i) => {
    const id = (g.id ?? String(i)).trim() || String(i);
    if (idToRef.has(id)) {
      warnings.push(`duplicate goal id "${id}" at index ${i} — ignoring the later one for wiring.`);
    } else {
      idToRef.set(id, i);
    }
    ids.push(id);
  });

  const dtos: GoalShareDto[] = [];
  const resolved: ResolvedGoal[] = [];

  goals.forEach((g, i) => {
    const id = ids[i]!;
    const { dto, res } = resolveGoal(g, i, id, warnings);
    dtos.push(dto);
    resolved.push(res);
  });

  // --- tree wiring, with dangling-edge drop and cycle prevention ---
  const andEdges: number[][] = dtos.map(() => []);
  const orEdges: number[][] = dtos.map(() => []);

  const canReach = (start: number, target: number, edges: number[][]): boolean => {
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const n = stack.pop()!;
      if (n === target) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const m of edges[n]!) stack.push(m);
    }
    return false;
  };

  const wire = (fromIdx: number, fromId: string, refIds: string[] | undefined, edges: number[][], kind: string) => {
    const out: string[] = [];
    for (const targetId of refIds ?? []) {
      const toRef = idToRef.get(targetId);
      if (toRef === undefined) {
        warnings.push(`goal "${fromId}" ${kind} unknown goal id "${targetId}" — edge dropped.`);
        continue;
      }
      if (toRef === fromIdx) {
        warnings.push(`goal "${fromId}" ${kind} itself — self-edge dropped.`);
        continue;
      }
      // adding fromIdx→toRef closes a cycle iff toRef can already reach fromIdx.
      if (canReach(toRef, fromIdx, edges)) {
        warnings.push(`goal "${fromId}" ${kind} "${targetId}" would create a dependency cycle — edge dropped.`);
        continue;
      }
      edges[fromIdx]!.push(toRef);
      out.push(targetId);
    }
    return out;
  };

  goals.forEach((g, i) => {
    resolved[i]!.requires = wire(i, ids[i]!, g.requires, andEdges, "requires");
    resolved[i]!.orRequires = wire(i, ids[i]!, g.orRequires, orEdges, "OR-requires");
  });

  dtos.forEach((dto, i) => {
    if (andEdges[i]!.length) dto.requires = andEdges[i]!;
    if (orEdges[i]!.length) dto.orRequires = orEdges[i]!;
  });

  // --- assemble bundle ---
  const kind = spec.mode === "section" ? "SECTION" : "GOALS";
  if (spec.mode === "section" && !spec.sectionName?.trim()) {
    warnings.push('mode "section" without a sectionName — the plugin will name it "Shared goals".');
  }
  const bundle: ShareBundle = {
    v: SCHEMA_VERSION,
    kind,
    sectionColorRgb: spec.sectionColorRgb ?? -1,
    goals: dtos,
  };
  if (spec.sharedBy?.trim()) bundle.sharedBy = spec.sharedBy.trim();
  if (kind === "SECTION" && spec.sectionName?.trim()) bundle.sectionName = spec.sectionName.trim();

  return { bundle, resolved, warnings, preview: renderPreview(spec, resolved, warnings) };
}

function resolveGoal(
  g: GoalSpec,
  ref: number,
  id: string,
  warnings: string[],
): { dto: GoalShareDto; res: ResolvedGoal } {
  const rawType = (g.type ?? "").trim().toLowerCase();

  // SKILL ----------------------------------------------------------------
  if (rawType === "skill" || asGoalType(g.type) === "SKILL") {
    const skillName = resolveSkill(g.skill ?? g.skillName);
    if (!skillName) {
      warnings.push(
        `goal "${id}": unknown skill "${g.skill ?? g.skillName ?? ""}" — emitted as CUSTOM (won't auto-track).`,
      );
      return custom(g, ref, id, "skill not recognized");
    }
    let xp = g.xp;
    if (xp === undefined) {
      if (g.level === undefined) {
        warnings.push(`goal "${id}": skill goal needs a level or xp — defaulting to level ${MAX_LEVEL}.`);
        xp = xpForLevel(MAX_LEVEL);
      } else if (!Number.isInteger(g.level) || g.level < 1 || g.level > 126) {
        warnings.push(`goal "${id}": level ${g.level} out of range 1..126 — emitted as CUSTOM.`);
        return custom(g, ref, id, "level out of range");
      } else {
        xp = xpForLevel(g.level);
      }
    }
    const display = SKILLS[skillName]!;
    const level = levelForXp(xp);
    // Canonical plugin label: "<Skill> - Level <N>".
    const name = g.name?.trim() || `${display} - Level ${level}`;
    const detail = `Level ${level} (${withCommas(xp)} xp)`;
    const dto: GoalShareDto = {
      ref,
      type: "SKILL",
      name,
      description: g.description?.trim() || "Skill",
      targetValue: xp,
      skillName,
    };
    if (g.optional) dto.optional = true;
    return {
      dto,
      res: { ref, id, type: "SKILL", name, detail, tracked: true, requires: [], orRequires: [] },
    };
  }

  // CUSTOM ---------------------------------------------------------------
  if (rawType === "custom" || asGoalType(g.type) === "CUSTOM") {
    return custom(g, ref, id);
  }

  // BOSS (typed core) ----------------------------------------------------
  if (rawType === "boss" || asGoalType(g.type) === "BOSS") {
    const target = g.targetValue && g.targetValue > 0 ? g.targetValue : 1; // default 1 KC
    const known = resolveBoss(g.bossName) ?? resolveBoss(g.name);
    if (known) {
      const name = g.name?.trim() || known;
      const dto: GoalShareDto = { ref, type: "BOSS", name, bossName: known, targetValue: target };
      if (g.description?.trim()) dto.description = g.description.trim();
      if (g.optional) dto.optional = true;
      return {
        dto,
        res: { ref, id, type: "BOSS", name, detail: `${known} · ${target} KC`, tracked: true, requires: [], orRequires: [] },
      };
    }
    const rawBoss = (g.bossName ?? "").trim();
    if (rawBoss) {
      warnings.push(
        `goal "${id}": boss "${rawBoss}" is not in the known boss list — emitted UNVERIFIED ` +
          `(auto-tracks only if it exactly matches the plugin's boss name).`,
      );
      const name = g.name?.trim() || rawBoss;
      const dto: GoalShareDto = { ref, type: "BOSS", name, bossName: rawBoss, targetValue: target };
      if (g.description?.trim()) dto.description = g.description.trim();
      if (g.optional) dto.optional = true;
      return {
        dto,
        res: {
          ref,
          id,
          type: "BOSS",
          name,
          detail: `${rawBoss} · ${target} KC`,
          tracked: false,
          note: "unverified identifier",
          requires: [],
          orRequires: [],
        },
      };
    }
    warnings.push(`goal "${id}": boss goal needs a bossName — emitted as CUSTOM.`);
    return custom(g, ref, id, "no boss name");
  }

  // ITEM_GRIND (typed core) ----------------------------------------------
  // Tracks by EXACT itemId. Resolve from an explicit itemId (validated against
  // the OSRS item corpus) or from the item name; a hit auto-tracks, an unknown
  // explicit id passes through unverified, and an unresolvable name falls to CUSTOM.
  if (rawType === "item_grind" || rawType === "item" || asGoalType(g.type) === "ITEM_GRIND") {
    const target = g.targetValue && g.targetValue > 0 ? g.targetValue : 1; // default 1
    const mkItem = (itemId: number, name: string, tracked: boolean, note?: string) => {
      const dto: GoalShareDto = { ref, type: "ITEM_GRIND", name, itemId, targetValue: target };
      if (g.description?.trim()) dto.description = g.description.trim();
      if (g.wikiUrl?.trim()) dto.wikiUrl = g.wikiUrl.trim();
      if (g.optional) dto.optional = true;
      const res: ResolvedGoal = {
        ref,
        id,
        type: "ITEM_GRIND",
        name,
        detail: `×${withCommas(target)}`,
        tracked,
        requires: [],
        orRequires: [],
      };
      if (note) res.note = note;
      return { dto, res };
    };

    if (g.itemId !== undefined && g.itemId > 0) {
      const known = itemNameById(g.itemId);
      if (known || isKnownItemId(g.itemId)) {
        return mkItem(g.itemId, g.name?.trim() || known || `Item ${g.itemId}`, true);
      }
      warnings.push(
        `goal "${id}": itemId ${g.itemId} is not in the known item table — emitted UNVERIFIED ` +
          `(auto-tracks only if it is a real item id on the recipient's account).`,
      );
      return mkItem(g.itemId, g.name?.trim() || `Item ${g.itemId}`, false, "unverified identifier");
    }

    const match = resolveItem(g.name);
    if (match) {
      // Resolving BY NAME: the canonical display wins (so "bp" → "Toxic blowpipe").
      // A deliberate custom label is supported via the explicit-itemId path above.
      return mkItem(match.itemId, match.name, true);
    }
    const suggestions = searchItems(g.name, 5);
    const didYouMean = suggestions.length
      ? ` Closest matches: ${suggestions.map((s) => `${s.name} (itemId ${s.itemId})`).join(", ")}.`
      : "";
    warnings.push(
      `goal "${id}": item "${g.name ?? ""}" not recognized — emitted as CUSTOM (won't auto-track). ` +
        `Supply an itemId (resolve it via the OSRS Wiki) to make it track.${didYouMean}`,
    );
    return custom(g, ref, id, "item not recognized");
  }

  // DIARY (typed core) ---------------------------------------------------
  // Tracks by varbitId + targetValue. Resolve from an explicit (known) varbitId
  // or from an area+tier name ("Ardougne Elite", "Varrock hard diary").
  if (rawType === "diary" || asGoalType(g.type) === "DIARY") {
    const mkDiary = (varbitId: number, targetValue: number, name: string, tracked: boolean, note?: string) => {
      const dto: GoalShareDto = { ref, type: "DIARY", name, varbitId, targetValue };
      if (g.description?.trim()) dto.description = g.description.trim();
      if (g.wikiUrl?.trim()) dto.wikiUrl = g.wikiUrl.trim();
      if (g.optional) dto.optional = true;
      const res: ResolvedGoal = {
        ref,
        id,
        type: "DIARY",
        name,
        detail: `varbit ${varbitId}`,
        tracked,
        requires: [],
        orRequires: [],
      };
      if (note) res.note = note;
      return { dto, res };
    };

    if (g.varbitId !== undefined && g.varbitId > 0) {
      const known = diaryTrackingByVarbit(g.varbitId);
      if (known) {
        return mkDiary(g.varbitId, known.targetValue, g.name?.trim() || known.name, true);
      }
      if (isKnownDiaryVarbit(g.varbitId)) {
        return mkDiary(g.varbitId, g.targetValue && g.targetValue > 0 ? g.targetValue : 1, g.name?.trim() || `Diary`, true);
      }
      warnings.push(
        `goal "${id}": varbitId ${g.varbitId} is not a known diary completion varbit — emitted UNVERIFIED.`,
      );
      return mkDiary(g.varbitId, g.targetValue && g.targetValue > 0 ? g.targetValue : 1, g.name?.trim() || `Diary`, false, "unverified identifier");
    }

    const match = resolveDiary(g.name);
    if (match) {
      return mkDiary(match.varbitId, match.targetValue, g.name?.trim() || match.name, true);
    }
    warnings.push(
      `goal "${id}": diary "${g.name ?? ""}" not recognized — emitted as CUSTOM (won't auto-track). ` +
        `Use an "<Area> <Tier>" name (areas: ${DIARY_AREAS.join(", ")}; tiers: Easy/Medium/Hard/Elite).`,
    );
    return custom(g, ref, id, "diary not recognized");
  }

  // QUEST (typed core) ----------------------------------------------------
  // Tracks via Quest.valueOf(questName) on the recipient — the wire value must
  // be the RuneLite enum CONSTANT (e.g. DRAGON_SLAYER_II), never the display
  // name. Resolve from an explicit questName (validated) or the goal name.
  if (rawType === "quest" || asGoalType(g.type) === "QUEST") {
    const mkQuest = (enumName: string, name: string, tracked: boolean, note?: string) => {
      const dto: GoalShareDto = { ref, type: "QUEST", name, questName: enumName, targetValue: 1 };
      if (g.description?.trim()) dto.description = g.description.trim();
      if (g.wikiUrl?.trim()) dto.wikiUrl = g.wikiUrl.trim();
      if (g.optional) dto.optional = true;
      const res: ResolvedGoal = {
        ref,
        id,
        type: "QUEST",
        name,
        detail: "Quest",
        tracked,
        requires: [],
        orRequires: [],
      };
      if (note) res.note = note;
      return { dto, res };
    };

    if (g.questName?.trim()) {
      const known = isKnownQuestEnum(g.questName);
      if (known) {
        return mkQuest(known.enumName, g.name?.trim() || known.displayName, true);
      }
      warnings.push(
        `goal "${id}": questName "${g.questName}" is not a RuneLite Quest enum constant — emitted ` +
          `UNVERIFIED (the recipient's QuestTracker only auto-tracks exact constants like DRAGON_SLAYER_I).`,
      );
      return mkQuest(g.questName.trim(), g.name?.trim() || g.questName.trim(), false, "unverified identifier");
    }

    const match = resolveQuest(g.name);
    if (match) {
      // Resolving BY NAME: the canonical display wins (so "ds2" → "Dragon Slayer II").
      // A deliberate custom label is supported via the explicit-questName path above.
      return mkQuest(match.enumName, match.displayName, true);
    }
    const suggestions = searchQuests(g.name, 5);
    const didYouMean = suggestions.length
      ? ` Closest matches: ${suggestions.map((s) => `${s.displayName} (${s.enumName})`).join(", ")}.`
      : "";
    warnings.push(
      `goal "${id}": quest "${g.name ?? ""}" not recognized — emitted as CUSTOM (won't auto-track).` +
        didYouMean,
    );
    return custom(g, ref, id, "quest not recognized");
  }

  // ACCOUNT (typed core) ----------------------------------------------------
  // Tracks via AccountMetric.valueOf(accountMetric) on the recipient — the wire
  // value must be the plugin's enum CONSTANT (e.g. QUEST_POINTS). Each metric
  // carries the plugin's sensible-target range; out-of-range targets warn but
  // still emit (the tracker clamps display, not correctness).
  if (rawType === "account" || asGoalType(g.type) === "ACCOUNT") {
    const mkAccount = (metricName: string, target: number, name: string, tracked: boolean, note?: string) => {
      const dto: GoalShareDto = { ref, type: "ACCOUNT", name, accountMetric: metricName, targetValue: target };
      if (g.description?.trim()) dto.description = g.description.trim();
      if (g.wikiUrl?.trim()) dto.wikiUrl = g.wikiUrl.trim();
      if (g.optional) dto.optional = true;
      const res: ResolvedGoal = {
        ref,
        id,
        type: "ACCOUNT",
        name,
        detail: `target ${withCommas(target)}`,
        tracked,
        requires: [],
        orRequires: [],
      };
      if (note) res.note = note;
      return { dto, res };
    };

    const targetFor = (m: AccountMetricRef): number => {
      if (g.targetValue !== undefined && g.targetValue > 0) {
        if (g.targetValue < m.minTarget || g.targetValue > m.maxTarget) {
          warnings.push(
            `goal "${id}": target ${withCommas(g.targetValue)} is outside the plugin's sensible range for ` +
              `${m.displayName} (${withCommas(m.minTarget)}–${withCommas(m.maxTarget)}) — emitted as-is.`,
          );
        }
        return g.targetValue;
      }
      warnings.push(
        `goal "${id}": no targetValue given for ${m.displayName} — assumed the maximum, ` +
          `${withCommas(m.maxTarget)}. Pass targetValue to pick a different milestone.`,
      );
      return m.maxTarget;
    };
    const leaguesNote = (m: AccountMetricRef): string | undefined =>
      m.leagues ? "Leagues metric — tracks on seasonal worlds only" : undefined;

    if (g.accountMetric?.trim()) {
      const known = isKnownAccountMetric(g.accountMetric);
      if (known) {
        return mkAccount(known.enumName, targetFor(known), g.name?.trim() || known.displayName, true, leaguesNote(known));
      }
      warnings.push(
        `goal "${id}": accountMetric "${g.accountMetric}" is not a plugin AccountMetric constant — emitted ` +
          `UNVERIFIED (the recipient's AccountTracker only auto-tracks exact constants like QUEST_POINTS).`,
      );
      const target = g.targetValue && g.targetValue > 0 ? g.targetValue : 1;
      return mkAccount(g.accountMetric.trim(), target, g.name?.trim() || g.accountMetric.trim(), false, "unverified identifier");
    }

    const match = resolveAccountMetric(g.name);
    if (match) {
      // Resolving BY NAME: the canonical display wins (so "qp" → "Quest Points").
      // A deliberate custom label is supported via the explicit-accountMetric path above.
      return mkAccount(match.enumName, targetFor(match), match.displayName, true, leaguesNote(match));
    }
    const suggestions = searchAccountMetrics(g.name, 5);
    const didYouMean = suggestions.length
      ? ` Closest matches: ${suggestions.map((s) => `${s.displayName} (${s.enumName})`).join(", ")}.`
      : " See list_supported_goals for the available metrics.";
    warnings.push(
      `goal "${id}": account metric "${g.name ?? ""}" not recognized — emitted as CUSTOM (won't auto-track).` +
        didYouMean,
    );
    return custom(g, ref, id, "account metric not recognized");
  }

  // Other GoalTypes: Phase 1 has no validation dataset. Pass through if the
  // caller supplied an explicit identifier; otherwise fall back to CUSTOM.
  const gt = asGoalType(g.type);
  if (gt) {
    const hasIdentifier =
      g.questName ||
      g.bossName ||
      g.accountMetric ||
      g.skillName ||
      (g.varbitId ?? 0) > 0 ||
      (g.itemId ?? 0) > 0 ||
      (g.caTaskId ?? -1) >= 0;
    if (hasIdentifier) {
      warnings.push(
        `goal "${id}": type ${gt} has no Phase-1 reference data — emitted with the identifier you supplied, ` +
          `but it is UNVERIFIED (will import; auto-tracking depends on the identifier being correct).`,
      );
      const name = g.name?.trim() || `${gt} goal`;
      const dto: GoalShareDto = { ref, type: gt, name };
      if (g.description?.trim()) dto.description = g.description.trim();
      if (g.targetValue !== undefined) dto.targetValue = g.targetValue;
      if (g.skillName) dto.skillName = g.skillName;
      if (g.questName) dto.questName = g.questName;
      if (g.accountMetric) dto.accountMetric = g.accountMetric;
      if (g.bossName) dto.bossName = g.bossName;
      if (g.varbitId !== undefined) dto.varbitId = g.varbitId;
      if (g.itemId !== undefined) dto.itemId = g.itemId;
      if (g.spriteId !== undefined) dto.spriteId = g.spriteId;
      if (g.caTaskId !== undefined) dto.caTaskId = g.caTaskId;
      if (g.wikiUrl?.trim()) dto.wikiUrl = g.wikiUrl.trim();
      if (g.optional) dto.optional = true;
      return {
        dto,
        res: {
          ref,
          id,
          type: gt,
          name,
          detail: passthroughDetail(gt, g),
          tracked: false,
          note: "unverified identifier",
          requires: [],
          orRequires: [],
        },
      };
    }
    warnings.push(`goal "${id}": type ${gt} not supported in Phase 1 and no identifier given — emitted as CUSTOM.`);
    return custom(g, ref, id, `${gt} → CUSTOM fallback`);
  }

  warnings.push(`goal "${id}": unknown type "${g.type}" — emitted as CUSTOM.`);
  return custom(g, ref, id, "unknown type");
}

function passthroughDetail(gt: GoalType, g: GoalSpec): string {
  switch (gt) {
    case "QUEST":
      return g.questName ? `Quest: ${g.questName}` : "Quest";
    case "BOSS":
      return g.bossName ? `${g.bossName}${g.targetValue ? ` · ${g.targetValue} KC` : ""}` : "Boss";
    case "ACCOUNT":
      return g.accountMetric ? `${g.accountMetric}${g.targetValue ? ` · ${g.targetValue}` : ""}` : "Account";
    case "DIARY":
      return `Diary${g.varbitId ? ` (varbit ${g.varbitId})` : ""}`;
    case "ITEM_GRIND":
      return `Item ${g.itemId ?? "?"}${g.targetValue ? ` ×${g.targetValue}` : ""}`;
    case "COMBAT_ACHIEVEMENT":
      return `CA task ${g.caTaskId ?? "?"}`;
    default:
      return TYPE_LABEL[gt] ?? gt;
  }
}

function custom(g: GoalSpec, ref: number, id: string, note?: string): { dto: GoalShareDto; res: ResolvedGoal } {
  const name = g.name?.trim() || `Goal ${ref + 1}`;
  const dto: GoalShareDto = { ref, type: "CUSTOM", name };
  if (g.description?.trim()) dto.description = g.description.trim();
  if (g.tooltip?.trim()) dto.tooltip = g.tooltip.trim();
  if (g.colorRgb !== undefined && g.colorRgb !== -1) dto.customColorRgb = g.colorRgb;
  if (g.optional) dto.optional = true;
  // Detail is the description if given, else empty (the "○ manual" badge already says it's a check-off).
  const detail = g.description?.trim() ?? "";
  return { dto, res: { ref, id, type: "CUSTOM", name, detail, tracked: false, note, requires: [], orRequires: [] } };
}

/**
 * Render the bundle as the goal list the user will actually get, in the SAME
 * order the plugin shows it: do-first prerequisites at the TOP (indented by
 * dependency depth), the final goal flush-left at the BOTTOM. Each line shows the
 * goal's type, target/detail, and whether it auto-tracks or is a manual
 * check-off. Shown by DEFAULT (no confirm) so the user can eyeball it and adjust
 * the spec before any code is generated.
 */
function renderPreview(spec: ShareSpec, resolved: ResolvedGoal[], warnings: string[]): string {
  const lines: string[] = [];
  const trackedCount = resolved.filter((r) => r.tracked).length;
  const sectionTitle = spec.mode === "section" ? spec.sectionName?.trim() || "Shared goals" : "Shared goals";

  lines.push("┌─ Goal Planner import preview ─────────────────");
  lines.push(`│ Section: "${sectionTitle}"  (created fresh on import; completed goals kept inline)`);
  if (spec.mode === "goals") lines.push(`│ Mode: loose goals (no section identity)`);
  if (spec.sharedBy?.trim()) lines.push(`│ Shared by: ${spec.sharedBy.trim()}`);
  lines.push(`│ ${resolved.length} goal(s) · ${trackedCount} auto-track · ${resolved.length - trackedCount} manual/unverified`);
  lines.push("│ Order: do-first at top → final goal at bottom (as shown in-game)");
  lines.push("└───────────────────────────────────────────────");
  lines.push("");

  const byId = new Map(resolved.map((r) => [r.id, r]));
  const childIds = new Set(resolved.flatMap((r) => [...r.requires, ...r.orRequires]));
  const roots = resolved.filter((r) => !childIds.has(r.id));
  const shown = new Set<number>();

  const kidsOf = (r: ResolvedGoal) =>
    [
      ...r.requires.map((cid) => ({ cid, or: false })),
      ...r.orRequires.map((cid) => ({ cid, or: true })),
    ].filter((k) => byId.has(k.cid));

  // Deepest dependency chain below a goal, so we can indent the FINAL goal the most
  // and its prerequisites progressively less (the plugin nests the dependent goal
  // INSIDE its prerequisites, not the other way round).
  const subtreeDepth = (r: ResolvedGoal): number => {
    const kids = kidsOf(r);
    return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => subtreeDepth(byId.get(k.cid)!)));
  };

  // One goal line: indentation (more = closer to the final goal), type/detail tag,
  // tracking badge. The dependent goal at the bottom of a tree is flagged "◀ final goal".
  const line = (r: ResolvedGoal, indentLevel: number, isOr: boolean, isFinal: boolean): string => {
    const indent = "  ".repeat(indentLevel);
    const orMark = isOr ? "(any-of) " : "";
    const badge = r.tracked ? "✓ auto-tracks" : r.note === "unverified identifier" ? "⚠ unverified" : "○ manual";
    const tag = `${TYPE_LABEL[r.type]}${r.detail ? ` · ${r.detail}` : ""}`;
    const finalMark = isFinal ? "   ◀ final goal" : "";
    return `${indent}${orMark}${r.name}   [${tag}]  ${badge}${finalMark}`;
  };

  // Bottom-up (post-order): emit prerequisites ABOVE the goal that needs them, with
  // the final goal indented the MOST and sitting at the bottom; prereqs are flush /
  // less indented at the top. indentLevel = maxDepth − depth (root → maxDepth).
  const render = (r: ResolvedGoal, depth: number, maxDepth: number, isOr: boolean, isRoot: boolean) => {
    const kids = kidsOf(r);
    for (const k of kids) {
      const c = byId.get(k.cid)!;
      if (shown.has(c.ref)) {
        // Shared prereq already listed under another goal — reference it, don't repeat.
        lines.push(`${"  ".repeat(Math.max(0, maxDepth - depth - 1))}${c.name} (also needed — listed elsewhere)`);
      } else {
        render(c, depth + 1, maxDepth, k.or, false);
      }
    }
    lines.push(line(r, maxDepth - depth, isOr, isRoot && kids.length > 0));
    shown.add(r.ref);
  };

  for (const r of roots) render(r, 0, subtreeDepth(r), false, true);
  // Any goal not reachable from a root (e.g. left over from a dropped cycle) — list flat.
  for (const r of resolved) if (!shown.has(r.ref)) render(r, 0, subtreeDepth(r), false, true);

  if (warnings.length) {
    lines.push("");
    lines.push("⚠ Warnings:");
    for (const w of warnings) lines.push(`  - ${w}`);
  }
  return lines.join("\n");
}
