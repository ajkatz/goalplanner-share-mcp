# Decisions — goalplanner-share-mcp

## 2026-06-11: Cross-section relation ids — explicit-only, local-wins, ambiguity drops

**Decision:** In the `sections[]` (GPSHARE2) craft form, a `requires`/`orRequires`
id resolves **within its own section first**; failing that, it matches a goal in
another section **only if the target goal has an explicit caller-supplied `id`**
and matches **exactly one** other section. The match is lifted off the goal's
section-scoped refs onto the bundle-level `crossEdges` list
(`{fromSection, fromRef, toSection, toRef, or}` — mirrors the plugin's
`CrossEdgeDto`). An id present in several other sections warns "ambiguous" and
drops; cycle detection runs over the whole bundle graph (section-local + cross
edges), so a cycle threaded through two sections is caught like a local one.

**Why explicit ids only:** goals without a caller id default to their list index
("0", "1", …) — index ids collide across sections constantly, so letting them
match cross-section would silently wire accidental edges. Explicit ids are
deliberate names; indexes stay section-local.

**Why local wins:** preserves the pre-crossEdges behaviour byte-for-byte for
every existing spec — a spec that resolved before resolves identically now.

**Parity:** verified against the plugin's real codec both directions (MCP-encoded
code with AND+OR cross edges decoded by `ShareCodec`/Gson via a throwaway JUnit
test; plugin-encoded code decoded here). Unknown-everywhere ids keep the
existing "unknown goal id — edge dropped" warning path.

## 2026-06-09: Charged weapon variants resolve to the CHARGED id

**Decision:** Plain wiki names of chargeable weapons ("Trident of the seas",
"Craw's bow") resolve to the **charged** itemId via curated NICKNAMES entries
whose targets are objtypes **codenames** (`tots_charged`,
`wild_cave_bow_charged`) — never hand-typed ids. Uncharged forms stay reachable
under their own wiki names ("Uncharged trident", "Craw's bow (u)") through the
generated display layer.

**Why these were invisible:** the resolver's two generated layers each miss this
class — the charged form is untradeable (no wiki-prices mapping row) AND its
codename is an internal slug (no normalize/loose match). Items whose charged
codename happens to match the display name (`scythe_of_vitur` 22325,
`sanguinesti_staff` 22323, `tumekens_shadow` 27275) already resolved to their
charged id, so charged-id-for-plain-name was the de-facto convention; the
curated entries make the slug-codename tail (tridents, wilderness weapons,
blood fury, crystal armour) consistent with it rather than special-casing them
to uncharged.

**Trade-off:** ItemTracker matches by EXACT id, so a "Trident of the seas" goal
does not count an uncharged trident in the bank. Documented in
list_supported_goals; users wanting the tradeable grind name the uncharged form.

**Alternative rejected:** regenerate item-names.data.ts from the full wiki item
table instead of the prices mapping — heavier scrape, and the divergent
untradeable tail is small, enumerable, and already covered by the
name-reference curation pattern (clan-corpus test asserts entries resolve).

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
