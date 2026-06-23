/**
 * Render a decoded {@link ShareBundle} as a human-readable breakdown — the
 * inverse view used by the decode tool to verify what a GPSHARE1: code actually
 * contains (relations are drawn from the bundle-local `ref` edges).
 */
import { type ShareBundle, type GoalShareDto, type SectionShareDto, effectiveSections } from "./bundle.js";

/** A goal "tracks" if it carries the identifier its type needs to match game state. */
const trackable = (g: GoalShareDto): boolean => {
  switch (g.type) {
    case "SKILL":
      return !!g.skillName && (g.targetValue ?? 0) > 0;
    case "QUEST":
      return !!g.questName;
    case "DIARY":
      return (g.varbitId ?? 0) > 0;
    case "BOSS":
      return !!g.bossName;
    case "ACCOUNT":
      return !!g.accountMetric;
    case "ITEM_GRIND":
      return (g.itemId ?? 0) > 0;
    case "COMBAT_ACHIEVEMENT":
      return (g.caTaskId ?? -1) >= 0;
    default:
      return false; // CUSTOM / COLLECTION_LOG
  }
};

export function describeBundle(bundle: ShareBundle): string {
  const sections = effectiveSections(bundle);
  const lines: string[] = [];
  lines.push(`Schema version: v${bundle.v}`);
  if (bundle.v >= 2) {
    const total = sections.reduce((n, s) => n + s.goals.length, 0);
    lines.push(`Sections: ${sections.length} (${total} goals total)`);
    if (bundle.sharedBy) lines.push(`Shared by: ${bundle.sharedBy}`);
    sections.forEach((sec, i) => {
      lines.push("");
      const label = sec.targetDefault
        ? "→ DEFAULT plan (existing equivalents reused on import)"
        : `"${sec.name ?? "Shared goals"}"`;
      lines.push(`── Section ${i + 1}/${sections.length}: ${label} — ${sec.goals.length} goal(s) ──`);
      if (sec.colorRgb >= 0) lines.push(`   colour: #${sec.colorRgb.toString(16).padStart(6, "0")}`);
      lines.push(describeGoalList(sec.goals));
    });
    if (bundle.crossEdges && bundle.crossEdges.length > 0) {
      lines.push("");
      lines.push(`── Cross-section dependencies (${bundle.crossEdges.length}) ──`);
      for (const e of bundle.crossEdges) {
        const from = edgeEndpoint(sections, e.fromSection, e.fromRef);
        const to = edgeEndpoint(sections, e.toSection, e.toRef);
        lines.push(`  • ${from} ${e.or ? "needs any of" : "requires"} ${to}`);
      }
    }
    return lines.join("\n");
  }
  lines.push(`Kind: ${bundle.kind}`);
  if (bundle.kind === "SECTION") lines.push(`Section name: "${bundle.sectionName ?? "(none)"}"`);
  if (bundle.sharedBy) lines.push(`Shared by: ${bundle.sharedBy}`);
  if (bundle.sectionColorRgb >= 0) lines.push(`Section colour: #${bundle.sectionColorRgb.toString(16).padStart(6, "0")}`);
  lines.push(`Goals: ${bundle.goals.length}`);
  lines.push("");
  lines.push(describeGoalList(bundle.goals));
  return lines.join("\n");
}

/** `"Goal name" (section 2 "Raids")` — or a placeholder for malformed indices
 *  (the plugin importer drops such edges silently; the breakdown should show them). */
function edgeEndpoint(sections: SectionShareDto[], secIdx: number, ref: number): string {
  const sec = sections[secIdx];
  const goal = sec?.goals.find((g) => g.ref === ref);
  const secLabel = sec ? `section ${secIdx + 1} "${sec.name ?? (sec.targetDefault ? "Default plan" : "Shared goals")}"` : `section ${secIdx + 1} (missing)`;
  if (!goal) return `(unresolved ref ${ref} in ${secLabel} — edge will be dropped on import)`;
  return `"${goal.name ?? "(unnamed)"}" (${secLabel})`;
}

function describeGoalList(goals: GoalShareDto[]): string {
  const lines: string[] = [];
  const byRef = new Map(goals.map((g) => [g.ref, g]));
  const childRefs = new Set(goals.flatMap((g) => [...(g.requires ?? []), ...(g.orRequires ?? [])]));
  const roots = goals.filter((g) => !childRefs.has(g.ref));
  const shown = new Set<number>();

  const idPart = (g: GoalShareDto): string => {
    const bits: string[] = [];
    if (g.skillName) bits.push(`skill=${g.skillName}`);
    if (g.questName) bits.push(`quest=${g.questName}`);
    if (g.bossName) bits.push(`boss=${g.bossName}`);
    if (g.accountMetric) bits.push(`metric=${g.accountMetric}`);
    if ((g.varbitId ?? 0) > 0) bits.push(`varbit=${g.varbitId}`);
    if ((g.itemId ?? 0) > 0) bits.push(`item=${g.itemId}`);
    if ((g.caTaskId ?? -1) >= 0) bits.push(`caTask=${g.caTaskId}`);
    if (g.targetValue) bits.push(`target=${g.targetValue}`);
    return bits.length ? ` (${bits.join(", ")})` : "";
  };

  const render = (g: GoalShareDto, depth: number) => {
    const indent = "  ".repeat(depth);
    const flag = trackable(g) ? "✓ tracks" : "CUSTOM/manual";
    lines.push(`${indent}• [${g.type}] ${g.name ?? "(unnamed)"}${idPart(g)} — ${flag}`);
    if (g.description) lines.push(`${indent}    desc: ${g.description}`);
    if (g.tooltip) lines.push(`${indent}    tooltip: ${g.tooltip}`);
    shown.add(g.ref);
    for (const r of g.requires ?? []) {
      const c = byRef.get(r);
      if (c && !shown.has(c.ref)) render(c, depth + 1);
      else if (c) lines.push(`${"  ".repeat(depth + 1)}↳ (also requires [${c.type}] ${c.name ?? "(unnamed)"})`);
    }
    for (const r of g.orRequires ?? []) {
      const c = byRef.get(r);
      if (c) {
        lines.push(`${"  ".repeat(depth + 1)}(OR) ↓`);
        if (!shown.has(c.ref)) render(c, depth + 1);
      }
    }
  };

  for (const g of roots) render(g, 0);
  for (const g of goals) if (!shown.has(g.ref)) render(g, 0);
  return lines.join("\n");
}
