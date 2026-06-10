/**
 * BiS loadout presets by combat style — HYBRID source: armour slots are taken
 * from the OSRS Wiki "Armour/Highest bonuses" tables (current — Amulet of
 * rancour, Confliction gauntlets, …); the weapon + cape are CURATED (the wiki
 * ranks weapons by raw bonus, which picks slow non-DPS weapons). All weapons are
 * 2h, so there is no shield slot.
 *
 * GENERATED — do not hand-edit. Regenerate with `npm run gen:loadouts`
 * (see scripts/gen-loadouts.mjs; needs network). Member ids include items newer
 * than the objtypes snapshot, so refdata/items.ts treats loadout ids as known.
 */
import type { ItemSet } from "./items.js";

const member = (itemId: number, name: string) => ({ itemId, name, codename: "" });

export const LOADOUTS_DATA: ReadonlyArray<readonly [string, ItemSet]> = [
  ["maxed melee", { name: "Maxed melee", members: [
      member(26382, "Torva full helm"),
      member(21295, "Infernal cape"),
      member(29801, "Amulet of rancour"),
      member(26384, "Torva platebody"),
      member(26386, "Torva platelegs"),
      member(22981, "Ferocious gloves"),
      member(31088, "Avernic treads"),
      member(28307, "Ultor ring"),
      member(22325, "Scythe of vitur"),
    ] }],
  ["maxed ranged", { name: "Maxed ranged", members: [
      member(27226, "Masori mask"),
      member(22109, "Ava's assembler"),
      member(19547, "Necklace of anguish"),
      member(27229, "Masori body"),
      member(27232, "Masori chaps"),
      member(26235, "Zaryte vambraces"),
      member(31088, "Avernic treads"),
      member(28310, "Venator ring"),
      member(20997, "Twisted bow"),
    ] }],
  ["maxed mage", { name: "Maxed mage", members: [
      member(21018, "Ancestral hat"),
      member(21793, "Imbued guthix cape"),
      member(12002, "Occult necklace"),
      member(21021, "Ancestral robe top"),
      member(21024, "Ancestral robe bottom"),
      member(31106, "Confliction gauntlets"),
      member(31088, "Avernic treads"),
      member(28313, "Magus ring"),
      member(27275, "Tumeken's shadow"),
    ] }],
];
