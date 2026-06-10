# Decisions — goalplanner-share-mcp

## 2026-06-04: Item name→id resolver sourcing (ITEM_GRIND)

**Decision:** Build the ITEM_GRIND name→`itemId` resolver from the OSRS cache
`objtypes.txt` (full `id ↔ codename` table, variant-filtered) + normalization +
loose (alphanumeric) matching + a small **curated, individually-verified alias
map**. Do NOT build an `id → displayName` overlay from the plugin's
`ItemSourceData.java`.

**Alternatives considered:**
- **ItemSourceData overlay** — rejected. Measured it: 2,370 unique ids with `//`
  display comments, but it is a *collection-log-slot → all-variant-ids* table (its
  own header says "ALL item ID variants… inventory, noted, collection log, follower
  forms"). The comment is the SLOT name stamped onto every variant id, so id 5883
  (a beer keg in objtypes) is labelled "Abyssal orphan". Using it as a per-id name
  map would make wrong items resolve — worse than the status quo. ~1,995 of 2,370
  "gains" were this mislabelled-variant noise.
- **Pure objtypes, no aliases** — rejected. Internal codenames diverge for
  consumables (`4doseprayerrestore`) and old items (`mcannonball`); ~30% of common
  consumables won't normalize-match.
- **Comprehensive hand-curated name table** — rejected as low-ROI and error-prone
  (display-name typos are exactly the bug class our test-discipline warns about).

**Rationale:** ~70%+ of common grindables' codenames ARE their display name with
underscores, so normalization carries the bulk; the loose (alphanumeric) key
absorbs the rest (e.g. "Vorkath pet" → `vorkathpet`). Only the genuinely-divergent
tail — pure-slug consumables and collection-log pet *nicknames* — needs aliases,
and that set is small and individually verifiable. The long tail is the caller's
job: resolve an id via the OSRS Wiki and pass `itemId` explicitly (validated
against the corpus). Loose-key ambiguity is just 0.5% (88 keys, all `_p/_p+/_p++`
poison-variant collisions) and is handled by a safe null + actionable warning.

**Context:** Phase 2 — bringing ITEM_GRIND into the typed (auto-tracking) core
using the newly-added OSRS MCP cache data. The measurement that exposed the
ItemSourceData slot-vs-item mismatch prevented shipping a corrupting overlay.
