/**
 * Boss reference data — the exact boss names the plugin tracks, from
 * `com.goalplanner.data.BossKillData.BOSSES` (each maps to a kill-count
 * VarPlayer). A BOSS goal tracks by `bossName`, so the name must match one of
 * these verbatim for the recipient's plugin to count kills.
 *
 * GENERATED — do not hand-edit. Regenerate with `npm run gen:bosses` (reads the
 * plugin source via $GOAL_PLANNER_REPO; see scripts/gen-bosses.mjs).
 * Source: runelite-goal-planner BossKillData.java (89 bosses).
 */

export const BOSSES: readonly string[] = [
  "Commander Zilyana",
  "General Graardor",
  "K'ril Tsutsaroth",
  "Kree'arra",
  "Nex",
  "Dagannoth Prime",
  "Dagannoth Rex",
  "Dagannoth Supreme",
  "Artio",
  "Callisto",
  "Calvar'ion",
  "Chaos Elemental",
  "Chaos Fanatic",
  "Crazy Archaeologist",
  "Scorpia",
  "Spindel",
  "Venenatis",
  "Vet'ion",
  "Abyssal Sire",
  "Cerberus",
  "Grotesque Guardians",
  "Kraken",
  "Thermy",
  "Alchemical Hydra",
  "Araxxor",
  "Barrows",
  "Bryophyta",
  "Corporeal Beast",
  "Deranged Arch.",
  "Giant Mole",
  "Hespori",
  "Kalphite Queen",
  "King Black Dragon",
  "Mimic",
  "Obor",
  "Phantom Muspah",
  "Sarachnis",
  "Skotizo",
  "Vorkath",
  "Zalcano",
  "Zulrah",
  "Duke Sucellus",
  "The Leviathan",
  "The Whisperer",
  "Vardorvis",
  "Duke (Awake)",
  "Leviathan (Awake)",
  "Whisperer (Awake)",
  "Vardorvis (Awake)",
  "CoX",
  "CoX (CM)",
  "ToB",
  "ToB (HM)",
  "ToB (Story)",
  "ToA (Entry)",
  "ToA",
  "ToA (Expert)",
  "TzTok-Jad",
  "TzKal-Zuk",
  "Sol Heredit",
  "Fortis Colosseum (Waves)",
  "The Nightmare",
  "Phosani's Nightmare",
  "Tempoross",
  "Wintertodt",
  "GotR",
  "The Gauntlet",
  "Corrupted Gauntlet",
  "Amoxliatl",
  "Hueycoatl",
  "Royal Titans",
  "Yama",
  "Scurrius",
  "Brutus",
  "Demonic Brutus",
  "Shellbane Gryphon",
  "Blue Moon",
  "Blood Moon",
  "Eclipse Moon",
  "Perilous Moons Chests",
  "Doom of Mokhaiotl (L1)",
  "Doom of Mokhaiotl (L2)",
  "Doom of Mokhaiotl (L3)",
  "Doom of Mokhaiotl (L4)",
  "Doom of Mokhaiotl (L5)",
  "Doom of Mokhaiotl (L6)",
  "Doom of Mokhaiotl (L7)",
  "Doom of Mokhaiotl (L8)",
  "Doom of Mokhaiotl (L8+)",
];

// Case-insensitive lookup → canonical boss name.
const BY_LOWER = new Map(BOSSES.map((b) => [b.toLowerCase(), b]));

/**
 * Resolve a user-supplied boss name to its canonical plugin name, or null if
 * unrecognized. Matches case-insensitively; also accepts a couple of common
 * aliases the plugin exposes via collection-log names.
 */
const ALIASES: Record<string, string> = {
  "the inferno": "TzKal-Zuk",
  inferno: "TzKal-Zuk",
  zuk: "TzKal-Zuk",
  "the fight caves": "TzTok-Jad",
  "fight caves": "TzTok-Jad",
  jad: "TzTok-Jad",
  // Raid full names — the plugin's canonical KC names are the short forms
  // (BossKillData.COLLECTION_LOG_ALIASES maps the same way).
  "chambers of xeric": "CoX",
  cox: "CoX",
  "chambers of xeric challenge mode": "CoX (CM)",
  "chambers of xeric (cm)": "CoX (CM)",
  "cox cm": "CoX (CM)",
  cm: "CoX (CM)",
  cms: "CoX (CM)",
  "theatre of blood": "ToB",
  "theatre of blood hard mode": "ToB (HM)",
  "tob hm": "ToB (HM)",
  hmt: "ToB (HM)",
  "tombs of amascut": "ToA",
  "tombs of amascut expert": "ToA (Expert)",
  "toa expert": "ToA (Expert)",
  // Community nicknames for canonical names that carry a qualifier.
  muspah: "Phantom Muspah",
  cerb: "Cerberus",
  hydra: "Alchemical Hydra",
  kree: "Kree'arra",
  kreearra: "Kree'arra",
  armadyl: "Kree'arra",
  duke: "Duke Sucellus",
  whisperer: "The Whisperer",
  whisp: "The Whisperer",
  leviathan: "The Leviathan",
  levi: "The Leviathan",
  bandos: "General Graardor",
  graardor: "General Graardor",
  sara: "Commander Zilyana",
  zilyana: "Commander Zilyana",
  saradomin: "Commander Zilyana",
  zammy: "K'ril Tsutsaroth",
  zamorak: "K'ril Tsutsaroth",
  kril: "K'ril Tsutsaroth",
  corp: "Corporeal Beast",
  pnm: "Phosani's Nightmare",
  phosani: "Phosani's Nightmare",
};

export function resolveBoss(input: string | undefined): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return BY_LOWER.get(key) ?? ALIASES[key] ?? null;
}
