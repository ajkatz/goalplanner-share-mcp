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
| ✅ Typed core (auto-tracks) | `SKILL`, `BOSS`, `ITEM_GRIND`, `DIARY`, `CUSTOM` | SKILL by level or XP (all 23 skills); BOSS by name (all 89 tracked bosses + aliases), KC target defaults to 1; ITEM_GRIND by item name against the full OSRS item table (or explicit `itemId`); DIARY by "<Area> <Tier>" name across 12 areas × 4 tiers (or explicit known `varbitId`) |
| 🧩 Group expansion (one phrase → many goals) | item sets/loadouts, boss & diary groups | `full torva` → 3, `maxed melee setup` → 9; `GWD` → 4 bosses, `Dagannoth Kings` → 3, `all bosses` → 89; `all elite diaries` → 12, `all Ardougne diaries` → 4, `all diaries` → 48 |
| 🔶 Passthrough (unverified) | `QUEST`, `ACCOUNT`, `COMBAT_ACHIEVEMENT` | emit if you supply the explicit identifier (`questName`, `accountMetric`, `caTaskId`); otherwise CUSTOM fallback |
| 🗺️ Roadmap | Phase 3: validated QUEST/ACCOUNT/CA from generated reference data | |

Boss names are generated from the plugin's `BossKillData` via `npm run gen:bosses`
(reads `$GOAL_PLANNER_REPO`). The item table is generated from the OSRS cache
`objtypes.txt` (JayArrowz `mcp-osrs`) via `npm run gen:items` (auto-discovers the
mcp-osrs data dir, or set `$OSRS_DATA_DIR`) — `placeholder_`/`cert_` variants filtered
out since the plugin tracks an exact `itemId`. Item names that diverge from their
internal codename (potions, `Cannonball`, …) resolve via a curated alias map or by you
passing an `itemId` you looked up on the OSRS Wiki. Community **nicknames** (`tbow`, `bp`,
`shadow`, `scythe`) and **armour sets** (`full torva`, `fortified masori`) are recognised too;
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

## Tools

- **`craft_import_string`** — `{ mode, sectionName?, sectionColorRgb?, sharedBy?, goals[], confirm? }`.
  Without `confirm`: human-readable preview + warnings, **no code**. With `confirm: true`:
  the `GPSHARE1:` code.
- **`decode_import_string`** — `{ code }`. Decodes any `GPSHARE1:` code (even embedded in
  surrounding text) into a readable breakdown for verification.
- **`list_supported_goals`** — what auto-tracks vs. falls back, plus the skill names.

### Goal spec fields

`id`, `type` (`"skill"` / `"custom"` / a GoalType name), `name`, `description`, `requires[]`,
`orRequires[]`, and per kind: skills use `skill` + `level` or `xp`; CUSTOM uses `colorRgb`,
`tooltip`; ITEM_GRIND uses `name` (resolved to an `itemId`) or an explicit `itemId`, plus
`targetValue` (quantity); passthrough types take `questName` / `bossName` / `accountMetric` /
`varbitId` / `caTaskId` / `targetValue`.

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

## Format

```
GPSHARE1:<base64url-nopad( gzip( JSON of ShareBundle ) )>
```

Mirrors the plugin's `ShareBundle` / `GoalShareDto` / `TagShareDto`. The importer is
tolerant: unknown goal types are skipped, strings are length-clamped, edges pointing
outside the bundle are dropped, and **every import lands in a new user section**.
