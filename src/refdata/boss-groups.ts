/**
 * Curated boss collections, so "GWD" / "Dagannoth Kings" / "all bosses" can fan
 * out into one BOSS goal per boss (parallel to item sets). Member names are
 * validated against the generated {@link BOSSES} list at load — anything that
 * drifts out of the plugin's tracked set is dropped rather than emitted wrong.
 */
import { BOSSES, resolveBoss } from "./bosses.js";

export interface BossGroup {
  name: string;
  members: string[]; // canonical boss names
}

const validate = (names: string[]): string[] => names.map((n) => resolveBoss(n)).filter((n): n is string => n !== null);

const GROUPS: Record<string, BossGroup> = {
  gwd: {
    name: "God Wars Dungeon",
    members: validate(["Commander Zilyana", "General Graardor", "K'ril Tsutsaroth", "Kree'arra"]),
  },
  dks: {
    name: "Dagannoth Kings",
    members: validate(["Dagannoth Prime", "Dagannoth Rex", "Dagannoth Supreme"]),
  },
  wilderness: {
    name: "Wilderness bosses",
    members: validate([
      "Callisto",
      "Venenatis",
      "Vet'ion",
      "Artio",
      "Spindel",
      "Calvar'ion",
      "Chaos Elemental",
      "Chaos Fanatic",
      "Crazy Archaeologist",
      "Scorpia",
    ]),
  },
};

/** Extra spellings → canonical group key. */
const GROUP_ALIASES: Record<string, string> = {
  "god wars": "gwd",
  "god wars dungeon": "gwd",
  godwars: "gwd",
  "dagannoth kings": "dks",
  "dag kings": "dks",
  dagannoths: "dks",
  wildy: "wilderness",
  "wilderness boss": "wilderness",
};

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(bosses|boss)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Resolve a boss-group phrase to its members, or null. Handles named groups
 * (GWD, DKs, wilderness) + "all bosses".
 */
export function resolveBossGroup(input: string | undefined): BossGroup | null {
  if (!input) return null;
  const key = norm(input);
  if (!key) return null;
  if (key === "all" || key === "every") return { name: "All bosses", members: [...BOSSES] };
  return GROUPS[key] ?? GROUPS[GROUP_ALIASES[key] ?? ""] ?? null;
}
