/**
 * Skill reference data — the 24 RuneLite `net.runelite.api.Skill` enum names
 * (OVERALL is excluded; it isn't a valid skill-goal target) plus the canonical
 * OSRS XP-for-level table. A SKILL goal tracks by `skillName` (enum name) +
 * `targetValue` (XP), so both must be exact for the recipient's plugin to match.
 */

/** enum name → human display name (matches RuneLite Skill.getName()). */
export const SKILLS: Record<string, string> = {
  ATTACK: "Attack",
  DEFENCE: "Defence",
  STRENGTH: "Strength",
  HITPOINTS: "Hitpoints",
  RANGED: "Ranged",
  PRAYER: "Prayer",
  MAGIC: "Magic",
  COOKING: "Cooking",
  WOODCUTTING: "Woodcutting",
  FLETCHING: "Fletching",
  FISHING: "Fishing",
  FIREMAKING: "Firemaking",
  CRAFTING: "Crafting",
  SMITHING: "Smithing",
  MINING: "Mining",
  HERBLORE: "Herblore",
  AGILITY: "Agility",
  THIEVING: "Thieving",
  SLAYER: "Slayer",
  FARMING: "Farming",
  RUNECRAFT: "Runecraft",
  HUNTER: "Hunter",
  CONSTRUCTION: "Construction",
  SAILING: "Sailing",
};

/** Highest normal level; virtual levels run to 126 but goals rarely need them. */
export const MAX_LEVEL = 99;

// Precompute the cumulative XP table once. xpTable[L] = total XP required for level L.
// OSRS formula: xpForLevel(L) = floor( (1/4) * sum_{n=1..L-1} floor(n + 300 * 2^(n/7)) ).
const xpTable: number[] = (() => {
  const table = [0, 0]; // index 0 unused; level 1 = 0 xp
  let points = 0;
  for (let level = 1; level < 126; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
})();

/** Total XP required to reach `level` (1..126). Throws for out-of-range input. */
export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 126) {
    throw new RangeError(`level must be an integer in 1..126 (got ${level})`);
  }
  return xpTable[level]!;
}

/** Highest level whose XP requirement is ≤ `xp` (the level a player at that XP would be). */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 1; l <= 126; l++) {
    if (xpTable[l]! <= xp) level = l;
    else break;
  }
  return level;
}

/**
 * Resolve a user-supplied skill name (enum name OR display name, any case) to its
 * canonical enum name, or null if unrecognized.
 */
export function resolveSkill(input: string | undefined): string | null {
  if (!input) return null;
  const upper = input.trim().toUpperCase();
  if (upper in SKILLS) return upper;
  // try matching by display name
  for (const [enumName, display] of Object.entries(SKILLS)) {
    if (display.toUpperCase() === upper) return enumName;
  }
  return null;
}
