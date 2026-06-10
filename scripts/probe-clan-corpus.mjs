// Dev probe: run the clan-Discord corpus's distinctive names through the
// resolvers and report what tracks vs. falls through. Not a test — a gap
// finder. Usage: npm run build && node scripts/probe-clan-corpus.mjs
import { resolveItem } from "../dist/refdata/items.js";
import { resolveBoss } from "../dist/refdata/bosses.js";
import { resolveAccountPhrase } from "../dist/refdata/accounts.js";

const items = [
  "Imbued heart", "Eternal gem", "Noxious point", "Noxious blade", "Noxious pommel",
  "Dragon hunter wand", "Zamorak hilt", "Staff of the dead", "Serp visage", "Serpentine visage",
  "Venator ring", "Bellator ring", "Voidwaker blade", "Voidwaker hilt", "Voidwaker gem",
  "Claws of callisto", "Torva helm", "Torva full helm", "Torva platebody", "Torva platelegs",
  "Nihil horn", "Zaryte vambraces", "Elidinis ward", "Kodai", "Kodai wand",
  "Ancestral top", "Ancestral hat", "Ancestral robe top", "Ancestral robe bottom", "Ancy legs", "Anc body",
  "Dragon claws", "DHCB", "Dragon hunter crossbow", "Dins", "Dinh's bulwark", "Twisted buckler",
  "Shadow", "Fang kit", "Cursed phalanx", "Twisted kit", "Twisted ancestral colour kit",
  "Sang kit", "Sang dust", "Sanguine dust", "Justi chest", "Justiciar chestguard",
  "ZCB", "Zaryte crossbow", "Virtus mask", "Ven vestige", "Venator vestige", "Bellator vestige",
  "Inq helm", "Inq legs", "Inq body", "Inq mace", "Inquisitor's mace", "Arcane sigil",
  "Jar of chemicals", "Moxi", "Jar of venom", "Callisto cub", "Karils leathertop", "Karil's leathertop",
  "Radiant oathplate", "Blorva", "Blood torva", "Venator bow", "Rancour", "Rancour amulet", "Amulet of rancour",
  "Eternals", "Eternal boots", "Fero", "Ferocious gloves", "Lance", "Dragon hunter lance",
  "Masori mask", "Ralos", "Tonalztics of ralos", "Occult", "Occult necklace", "Rangers", "Ranger boots",
  "Avernic", "Avernic defender hilt", "Scythe", "Scythe of vitur",
  "Cloth", "Mokhaiotl cloth", "Treads", "Avernic treads", "ACB", "Armadyl crossbow", "Saradomin hilt",
  "Zammy hasta", "Zamorakian hasta", "Amulet of torture", "Dragon warhammer", "Emberlight",
  "Scorching bow", "Crystal armour seed", "Ancient sceptre", "Purging staff", "Tormented bracelet",
  "Eye of ayak", "Confliction gauntlets", "Lightbearer", "Zombie helmet",
  "Pharoah's sceptre", "Pharaoh's sceptre", "Ancient effigy", "Tyrannical ring", "Scorpia's offspring",
  "Dragon pickaxe", "Bottled storm", "Broken dragon hook", "Executioner's axe head",
  "Leviathan's lure", "Eye of the duke", "Oathplate helm", "Oathplate chest", "Oathplate legs",
  "Elder maul", "Quiver", "Blessed dizana's quiver", "Dizana's quiver",
];

const bosses = [
  "toa", "Tombs of Amascut", "tob", "Theatre of Blood", "hmt", "cm", "Chambers of Xeric Challenge Mode",
  "Muspah", "Phantom Muspah", "Araxxor", "Cerb", "Cerberus", "Hydra", "Alchemical Hydra",
  "Kree", "Kree'arra", "Duke", "Duke Sucellus", "Vardorvis", "Whisperer", "Leviathan",
  "Phosani's Nightmare", "Pnm", "Bandos", "General Graardor", "Corp", "Corporeal Beast",
  "Royal Titans", "Yama", "Doom", "Doom of Mokhaiotl", "Nex", "Zulrah", "Callisto", "Sara", "Zilyana",
];

const accounts = [
  "Max TTL", "ttl", "total level", "Quest cape", "Elite CAs", "Master CAs", "gm cas",
  "Grandmaster Combat Achievements", "2100 total", "maxing",
];

let hit = 0, miss = 0;
const report = (kind, name, res) => {
  if (res) { hit++; console.log(`  ✓ ${kind}  ${name}  →  ${res}`); }
  else { miss++; console.log(`  ✗ ${kind}  ${name}`); }
};

console.log("== ITEMS ==");
for (const n of items) report("item", n, resolveItem(n) ? `${resolveItem(n).name} (${resolveItem(n).itemId})` : null);
console.log("== BOSSES ==");
for (const n of bosses) report("boss", n, resolveBoss(n));
console.log("== ACCOUNT ==");
for (const n of accounts) report("acct", n, (() => { const r = resolveAccountPhrase(n); return r ? `${r.metric.enumName}${r.impliedTarget !== undefined ? " @ " + r.impliedTarget : ""}` : null; })());
console.log(`\n${hit} resolve, ${miss} miss`);
