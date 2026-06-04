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
| ✅ Typed core (auto-tracks) | `SKILL`, `BOSS`, `CUSTOM` | SKILL by level or XP (all 23 skills); BOSS by name (all 89 tracked bosses + aliases like "the inferno"/"jad"), KC target defaults to 1 |
| 🔶 Passthrough (unverified) | `QUEST`, `DIARY`, `ACCOUNT`, `ITEM_GRIND`, `COMBAT_ACHIEVEMENT` | emit if you supply the explicit identifier (`questName`, `varbitId`, …); otherwise CUSTOM fallback |
| 🗺️ Roadmap | Phase 2: validated QUEST/DIARY from generated reference data; Phase 3: ACCOUNT/CA | |

Boss names are generated from the plugin's `BossKillData` via `npm run gen:bosses`
(reads `$GOAL_PLANNER_REPO`), so they stay in sync.

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
`tooltip`; passthrough types take `questName` / `bossName` / `accountMetric` / `varbitId` /
`itemId` / `caTaskId` / `targetValue`.

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
