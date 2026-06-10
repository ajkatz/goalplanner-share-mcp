/**
 * Achievement-diary reference data — "(AREA|TIER)" → { varbitId, targetValue }.
 * A DIARY goal tracks by varbit: the recipient's DiaryTracker reads
 * `getVarbitValue(varbitId)` and treats it complete at `targetValue` (1 for
 * boolean COMPLETE varbits; the tier task count for Karamja Easy/Medium/Hard).
 *
 * GENERATED — do not hand-edit. Regenerate with `npm run gen:diaries`
 * (see scripts/gen-diaries.mjs). Joins the plugin's AchievementDiaryData.java
 * structure with numeric ids from the OSRS cache varbittypes.txt.
 * Areas (12): ARDOUGNE, DESERT, FALADOR, FREMENNIK, KANDARIN, KARAMJA, KOUREND, LUMBRIDGE, MORYTANIA, VARROCK, WESTERN, WILDERNESS. 48 (area, tier) entries.
 */

export interface DiaryTracking {
  varbitId: number;
  targetValue: number;
}

export const DIARY_TRACKING: ReadonlyArray<readonly [string, DiaryTracking]> = [
  ["ARDOUGNE|EASY", { varbitId: 4458, targetValue: 1 }],
  ["ARDOUGNE|MEDIUM", { varbitId: 4459, targetValue: 1 }],
  ["ARDOUGNE|HARD", { varbitId: 4460, targetValue: 1 }],
  ["ARDOUGNE|ELITE", { varbitId: 4461, targetValue: 1 }],
  ["DESERT|EASY", { varbitId: 4483, targetValue: 1 }],
  ["DESERT|MEDIUM", { varbitId: 4484, targetValue: 1 }],
  ["DESERT|HARD", { varbitId: 4485, targetValue: 1 }],
  ["DESERT|ELITE", { varbitId: 4486, targetValue: 1 }],
  ["FALADOR|EASY", { varbitId: 4462, targetValue: 1 }],
  ["FALADOR|MEDIUM", { varbitId: 4463, targetValue: 1 }],
  ["FALADOR|HARD", { varbitId: 4464, targetValue: 1 }],
  ["FALADOR|ELITE", { varbitId: 4465, targetValue: 1 }],
  ["FREMENNIK|EASY", { varbitId: 4491, targetValue: 1 }],
  ["FREMENNIK|MEDIUM", { varbitId: 4492, targetValue: 1 }],
  ["FREMENNIK|HARD", { varbitId: 4493, targetValue: 1 }],
  ["FREMENNIK|ELITE", { varbitId: 4494, targetValue: 1 }],
  ["KANDARIN|EASY", { varbitId: 4475, targetValue: 1 }],
  ["KANDARIN|MEDIUM", { varbitId: 4476, targetValue: 1 }],
  ["KANDARIN|HARD", { varbitId: 4477, targetValue: 1 }],
  ["KANDARIN|ELITE", { varbitId: 4478, targetValue: 1 }],
  ["KARAMJA|EASY", { varbitId: 2423, targetValue: 10 }],
  ["KARAMJA|MEDIUM", { varbitId: 6288, targetValue: 19 }],
  ["KARAMJA|HARD", { varbitId: 6289, targetValue: 10 }],
  ["KARAMJA|ELITE", { varbitId: 4566, targetValue: 1 }],
  ["KOUREND|EASY", { varbitId: 7925, targetValue: 1 }],
  ["KOUREND|MEDIUM", { varbitId: 7926, targetValue: 1 }],
  ["KOUREND|HARD", { varbitId: 7927, targetValue: 1 }],
  ["KOUREND|ELITE", { varbitId: 7928, targetValue: 1 }],
  ["LUMBRIDGE|EASY", { varbitId: 4495, targetValue: 1 }],
  ["LUMBRIDGE|MEDIUM", { varbitId: 4496, targetValue: 1 }],
  ["LUMBRIDGE|HARD", { varbitId: 4497, targetValue: 1 }],
  ["LUMBRIDGE|ELITE", { varbitId: 4498, targetValue: 1 }],
  ["MORYTANIA|EASY", { varbitId: 4487, targetValue: 1 }],
  ["MORYTANIA|MEDIUM", { varbitId: 4488, targetValue: 1 }],
  ["MORYTANIA|HARD", { varbitId: 4489, targetValue: 1 }],
  ["MORYTANIA|ELITE", { varbitId: 4490, targetValue: 1 }],
  ["VARROCK|EASY", { varbitId: 4479, targetValue: 1 }],
  ["VARROCK|MEDIUM", { varbitId: 4480, targetValue: 1 }],
  ["VARROCK|HARD", { varbitId: 4481, targetValue: 1 }],
  ["VARROCK|ELITE", { varbitId: 4482, targetValue: 1 }],
  ["WESTERN|EASY", { varbitId: 4471, targetValue: 1 }],
  ["WESTERN|MEDIUM", { varbitId: 4472, targetValue: 1 }],
  ["WESTERN|HARD", { varbitId: 4473, targetValue: 1 }],
  ["WESTERN|ELITE", { varbitId: 4474, targetValue: 1 }],
  ["WILDERNESS|EASY", { varbitId: 4466, targetValue: 1 }],
  ["WILDERNESS|MEDIUM", { varbitId: 4467, targetValue: 1 }],
  ["WILDERNESS|HARD", { varbitId: 4468, targetValue: 1 }],
  ["WILDERNESS|ELITE", { varbitId: 4469, targetValue: 1 }],
];
