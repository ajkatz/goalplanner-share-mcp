# goalplanner-share-mcp

An [MCP](https://modelcontextprotocol.io) server that crafts **RuneLite Goal Planner**
import strings (`GPSHARE1:` codes) from a structured, natural-language-friendly goal
spec — so an assistant can turn *"plan my Inferno prep: 90 Ranged, 70 Defence, then beat
the Inferno"* into a paste-ready code, confirming your intent before it emits anything.

Pure string generator — **no plugin changes required**. Verified byte-compatible with the
plugin's own `com.goalplanner.share.ShareCodec` in both directions (the plugin decodes
codes this tool produces, and this tool decodes codes the plugin produces).

## What it does

- **Two modes**: import as a **new named section**, or as **loose goals** (which land in a
  "Shared goals" section).
- **Multi-section codes (GPSHARE2)**: pass `sections[]` and ONE code carries several
  sections — each imports as its own section, in one undo. A section with
  `targetDefault: true` lands in the recipient's **Default plan** instead, REUSING
  existing equivalent goals (the in-game add dedup), so re-importing never duplicates.
  Single-section codes still emit the `GPSHARE1:` wire, which every plugin build imports;
  multi-section/default-target codes need a recent plugin build.
- **Cross-section dependencies**: in the `sections[]` form, a goal may `requires`/
  `orRequires` a goal in a *different* section by its explicit `id`. The edge rides the
  bundle-level `crossEdges` wire field (mirroring the plugin's `CrossEdgeDto`) and is
  rewired on import. Section-local ids always win; an id found in several other sections
  is ambiguous and dropped with a warning; cycles are checked across the whole bundle.
  The preview marks the link on the dependent goal:

  ```
  ═══ Section 2/2: "Inferno prep" ═══
  Ranged - Level 90   [Skill · Level 90 (5,346,332 xp)]  ✓ auto-tracks
    ↪ needs "Imbued heart" — from section 1 "Slayer"
    TzKal-Zuk   [Boss · TzKal-Zuk · 1 KC]  ✓ auto-tracks   ◀ final goal
  ```
- **Simple goals or complex trees**: goals are wired into prerequisite trees (AND via
  `requires`, OR via `orRequires`) by stable `id`. Diamonds and OR-groups are supported.
- **Hybrid typing**: recognized kinds become **typed, auto-tracking** goals; anything else
  falls back to a **CUSTOM** goal (imports fine, manual check-off). Every fallback, dropped
  edge, or cycle is reported as a warning.
- **Confirm-first, preview by default**: `craft_import_string` renders the **goal list as it
  will import** — section header, each goal with its type/target, prerequisites nested as a
  guide tree, and per-goal tracking badges — with **no code emitted**. The user eyeballs it and
  adjusts; the code is produced only on a follow-up call with `confirm: true`.

  The list is rendered in the **same order and nesting the plugin shows** — do-first
  prerequisites flush-left at the top; the dependent goal indented beneath them, with
  the final goal at the bottom:

  ```
  ┌─ Goal Planner import preview ─────────────────
  │ Section: "Inferno prep"  (created fresh on import; completed goals kept inline)
  │ 4 goal(s) · 4 auto-track · 0 manual/unverified
  │ Order: do-first at top → final goal at bottom (as shown in-game)
  └───────────────────────────────────────────────

  Ranged - Level 90   [Skill · Level 90 (5,346,332 xp)]  ✓ auto-tracks
  Defence - Level 70   [Skill · Level 70 (737,627 xp)]  ✓ auto-tracks
  Beat the Fight Caves   [Boss · TzTok-Jad · 1 KC]  ✓ auto-tracks
    Beat the Inferno   [Boss · TzKal-Zuk · 1 KC]  ✓ auto-tracks   ◀ final goal
  ```

### Goal coverage

| Status | Types | Notes |
|---|---|---|
| ✅ Typed core (auto-tracks) | `SKILL`, `BOSS`, `ITEM_GRIND`, `DIARY`, `QUEST`, `ACCOUNT`, `COMBAT_ACHIEVEMENT`, `CUSTOM` | SKILL by level or XP (all 24 skills); BOSS by name (all 89 tracked bosses + aliases), KC target defaults to 1; ITEM_GRIND by item name against the full OSRS item table (or explicit `itemId`), with collection-log items auto-carrying their drop-source tag (boss/raid/clue/minigame/"All Pets"), matching the plugin's in-game seeding; DIARY by "<Area> <Tier>" name across 12 areas × 4 tiers (or explicit known `varbitId`); QUEST by display name/abbreviation (209 quests+miniquests, wire carries the RuneLite `Quest` enum constant); ACCOUNT by metric name/shorthand (16 plugin `AccountMetric`s incl. Collection Log Slots and Diary Tiers; phrases like "maintain quest cape" imply metric AND milestone — quest-point max is 335 as of The Red Reef; out-of-range targets warn but emit, matching the plugin's allow-over-max behaviour; missing target = max); COMBAT_ACHIEVEMENT by exact task name (637 tasks, wire carries `caTaskId` 0–639, tier sprite + description match in-game-created goals) |
| 🧩 Group expansion (one phrase → many goals) | item sets/loadouts, boss & diary groups | `full torva` → 3, `maxed melee setup` → 9; `GWD` → 4 bosses, `Dagannoth Kings` → 3, `all bosses` → 89; `all elite diaries` → 12, `all Ardougne diaries` → 4, `all diaries` → 48 |
| 🔶 Passthrough (unverified) | unknown `questName` / `accountMetric` / `caTaskId` / `varbitId` / `itemId` identifiers | emitted as supplied with an UNVERIFIED warning; unresolvable names fall back to CUSTOM with did-you-mean suggestions |
| 🗺️ Roadmap | CA tier groups (`all easy CAs`), quest groups (`all f2p quests`) | |

Boss names are generated from the plugin's `BossKillData` via `npm run gen:bosses`
(reads `$GOAL_PLANNER_REPO`). The item table is generated from the OSRS cache
`objtypes.txt` (JayArrowz `mcp-osrs`) via `npm run gen:items` (auto-discovers the
mcp-osrs data dir, or set `$OSRS_DATA_DIR`) — `placeholder_`/`cert_` variants filtered
out since the plugin tracks an exact `itemId`. Item names that diverge from their
internal codename (potions, `Cannonball`, …) resolve via a curated alias map or by you
passing an `itemId` you looked up on the OSRS Wiki. A second generated layer
(`npm run gen:item-names`, wiki prices mapping) adds authoritative **display names** for ~4.5k
tradeables — so the codename-divergent tail (Armadyl crossbow, Amulet of torture, Voidwaker
pieces) resolves without curation. Community **nicknames** (`tbow`, `bp`,
`shadow`, `scythe`, `zcb`, `dhcb`, `fero`, `rancour`, `blorva`, `fang kit`, …) resolve by NAME
REFERENCE through the generated tables (never hand-typed ids) and **armour sets** (`full torva`, `fortified masori`) are recognised too;
**loadout presets** (`maxed melee setup`, `maxed ranged`, `maxed mage`) expand to a full BiS-ish
kit; and a `+`/`and`-joined **phrase** (`full masori + tbow`, `maxed melee + shadow`) fans out into
one auto-tracking item goal per piece (visible in the preview before you confirm).

The diary table is generated via `npm run gen:diaries`, which **joins two sources**: the
plugin's `AchievementDiaryData` (area/tier structure + required values) with the numeric
varbit ids from the OSRS cache `varbittypes.txt` — the symbolic `VarbitID.<AREA>_DIARY_<TIER>_COMPLETE`
constants are matched by name to their cache ids (the runtime varbit the recipient reads).

The loadout presets are generated via `npm run gen:loadouts` (needs network), a **hybrid**: armour
slots come from the OSRS Wiki `Armour/Highest bonuses` tables (so they stay current — e.g. Amulet
of rancour), resolved to ids via the wiki's prices-mapping API; the weapon + cape are **curated**
because the wiki ranks weapons by raw bonus, which picks slow non-DPS weapons (Zombie axe, Kodai
wand). Loadout member ids can be newer than the objtypes snapshot, so they're treated as known.

The quest table is generated via `npm run gen:quests`, which **runs the real RuneLite `Quest`
enum** (`values()`/`name()`/`getName()`) from the version-matched `runelite-api` jar in the local
gradle cache — the recipient's QuestTracker does `Quest.valueOf(questName)`, so the wire must carry
the enum **constant** (`DRAGON_SLAYER_II`), and running the enum keeps the constant↔display pairing
from ever drifting. The account-metric table (`npm run gen:accounts`) parses the plugin's
`AccountMetric.java` (the tracker's `AccountMetric.valueOf` constants + each metric's sensible
target range + leagues flags). The CA table (`npm run gen:cas`, needs network) fetches the OSRS
Wiki `combat_achievement` bucket — the **same table the plugin's `WikiCaRepository` loads** —
where the bucket `id` is the bit index (0–639) into the `CA_TASK_COMPLETED` varplayers.

Cross-language parity for all three Phase-2 types is proven the same way as Phase 1: the plugin's
real `ShareCodec` decoded a TS-crafted code and `Quest.valueOf` / `AccountMetric.valueOf` /
the caTaskId range check resolved on the Java side (throwaway JUnit test, removed after the run).

### Real-world corpus test

`test/clan-corpus.test.ts` runs ~140 labeled goals collected from a clan Discord
(`test/fixtures/clan-discord-goals-raw.txt`, verbatim) through the full builder — community
shorthand, KC goals, account milestones ("Elite CAs" → CA points @ 1064), and the lines that
legitimately fall to CUSTOM (greenlogs, outfits, minigames). Add new community examples there;
the test names each line so a regression reads as English.

## Tools

- **`craft_import_string`** — `{ mode?, sectionName?, sectionColorRgb?, sharedBy?, goals[]?, sections[]?, confirm? }`
  (`sections[]` = multi-section/default-target form; each entry is `{ name?, sectionColorRgb?, targetDefault?, goals[] }`).
  Without `confirm`: human-readable preview + warnings, **no code**. With `confirm: true`:
  the paste-ready code (`GPSHARE1:` single-section, `GPSHARE2:` multi-section).
- **`decode_import_string`** — `{ code }`. Decodes any `GPSHARE1:`/`GPSHARE2:` code (even
  embedded in surrounding text) into a readable breakdown for verification — sections,
  identifiers, prerequisite tree, per-goal `desc:`/`tooltip:` echo, and a
  **Cross-section dependencies** list with resolved goal names:

  ```
  ── Cross-section dependencies (1) ──
    • "TzKal-Zuk" (section 2 "Inferno prep") requires "Imbued heart" (section 1 "Slayer")
  ```
- **`list_supported_goals`** — what auto-tracks vs. falls back, plus the skill names.

### Goal spec fields

`id`, `type` (`"skill"` / `"custom"` / a GoalType name), `name`, `description`, `requires[]`,
`orRequires[]`, and per kind: skills use `skill` + `level` or `xp`; CUSTOM uses `colorRgb`,
`tooltip`; ITEM_GRIND uses `name` (resolved to an `itemId`) or an explicit `itemId`, plus
`targetValue` (quantity); QUEST uses `name` (resolved) or explicit `questName` (enum constant);
ACCOUNT uses `name` or explicit `accountMetric` plus `targetValue`; COMBAT_ACHIEVEMENT uses `name`
(exact task) or explicit `caTaskId`.

## Develop

```bash
npm install
npm test        # vitest unit + codec/build tests
npm run build   # tsc → dist/
node test/smoke.mjs   # end-to-end MCP stdio smoke test (after build)
```

## Register in Claude

After `npm run build`, register the server. **Project scope** — a `.mcp.json` at a project
root (committable; activates when Claude Code runs in that project):

```json
{
  "mcpServers": {
    "goalplanner-share": { "type": "stdio", "command": "node", "args": ["dist/index.js"] }
  }
}
```

Use a relative `dist/index.js` only in this repo's own `.mcp.json` (cwd = repo root). For a
`.mcp.json` in any other project, or for **user scope** (`~/.claude.json` → top-level
`mcpServers`, available everywhere), use the absolute path:

```json
{
  "mcpServers": {
    "goalplanner-share": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/goalplanner-share-mcp/dist/index.js"]
    }
  }
}
```

The server loads at Claude Code startup, so a newly-registered server appears in the *next*
session. Claude Desktop uses the same block in `claude_desktop_config.json`.

## Deploying changes

There is **no hosted or remote deployment** — this is a local stdio MCP server. Each user runs
it from `dist/index.js` on their own machine (the `mcpServers` block above); the client spawns
it over stdio at startup.

Because the client runs the **built** `dist/`, not the TypeScript source, changes only take
effect after a rebuild:

1. Pull / make your edits (source lives in `src/`; reference data in `src/refdata/`).
2. `npm run build` — `dist/` is gitignored, so this is always a fresh local build, never committed.
3. Restart the client (or reconnect the server) so the new `dist/` is loaded — it's read once at startup.

Skipping the rebuild is the usual cause of a **stale server** serving old data (e.g. regenerated
`refdata/` that hasn't been compiled into `dist/` yet). If you regenerate reference data with any
`npm run gen:*` script, follow it with `npm run build` before the change reaches the running server.

## Format

```
GPSHARE1:<base64url-nopad( gzip( JSON of ShareBundle ) )>
```

Mirrors the plugin's `ShareBundle` / `GoalShareDto` / `TagShareDto`. The importer is
tolerant: unknown goal types are skipped, strings are length-clamped, edges pointing
outside the bundle are dropped, and **every import lands in a new user section**.
