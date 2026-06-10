/**
 * MCP server exposing three tools for crafting RuneLite Goal Planner share codes:
 *   • craft_import_string — two-phase: preview (default) then confirm:true to emit
 *   • decode_import_string — read back / verify a GPSHARE1: code
 *   • list_supported_goals — what the typed core auto-tracks vs CUSTOM-fallbacks
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildBundle, TYPED_CORE, type ShareSpec } from "./build.js";
import { encode, decode, ShareFormatError } from "./codec.js";
import { describeBundle } from "./describe.js";
import { SKILLS } from "./refdata/skills.js";
import { BOSSES } from "./refdata/bosses.js";
import { ITEM_COUNT } from "./refdata/items.js";
import { DIARY_COUNT } from "./refdata/diaries.js";

const goalShape = z.object({
  id: z.string().optional().describe("Stable label for this goal, used by other goals' requires/orRequires. Defaults to the index."),
  type: z.string().describe('Goal kind: "skill", "custom", or a GoalType name (QUEST/DIARY/BOSS/ACCOUNT/ITEM_GRIND/COMBAT_ACHIEVEMENT). Unrecognized → CUSTOM.'),
  name: z.string().optional().describe("Display name. Auto-derived for skills if omitted."),
  description: z.string().optional(),
  skill: z.string().optional().describe('Skill name for type "skill" (e.g. "Attack"), case-insensitive.'),
  level: z.number().int().optional().describe("Target skill level 1..126 (converted to XP)."),
  xp: z.number().int().optional().describe("Target skill XP (overrides level)."),
  tooltip: z.string().optional(),
  colorRgb: z.number().int().optional().describe("CUSTOM goal colour as 0xRRGGBB int; -1 = default."),
  optional: z.boolean().optional(),
  // explicit typed identifiers (passthrough for types without Phase-1 refdata)
  skillName: z.string().optional(),
  questName: z.string().optional().describe("RuneLite Quest enum name, e.g. DRAGON_SLAYER_II."),
  accountMetric: z.string().optional(),
  bossName: z.string().optional(),
  varbitId: z.number().int().optional(),
  itemId: z.number().int().optional(),
  spriteId: z.number().int().optional(),
  caTaskId: z.number().int().optional(),
  targetValue: z.number().int().optional(),
  wikiUrl: z.string().optional(),
  requires: z.array(z.string()).optional().describe("ids of goals this one depends on (AND)."),
  orRequires: z.array(z.string()).optional().describe("ids of goals satisfying this one (OR / any-of)."),
});

const craftShape = {
  mode: z.enum(["section", "goals"]).describe('"section" = import as a new named section; "goals" = loose goals (land in a "Shared goals" section).'),
  sectionName: z.string().optional().describe('Name for the new section (mode "section").'),
  sectionColorRgb: z.number().int().optional().describe("Section colour 0xRRGGBB; -1 = default."),
  sharedBy: z.string().optional().describe("Attribution shown in the import prompt."),
  goals: z.array(goalShape).describe("The goals to encode. Relations are wired by id via requires/orRequires."),
  confirm: z.boolean().optional().describe("Omit/false to get a preview ONLY (no code). Set true to emit the GPSHARE1: code after the user confirms the preview."),
};

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

export function createServer(): McpServer {
  const server = new McpServer({ name: "goalplanner-share-mcp", version: "0.1.0" });

  server.registerTool(
    "craft_import_string",
    {
      title: "Craft a Goal Planner import string",
      description:
        "Build a RuneLite Goal Planner GPSHARE1: import code from a structured goal spec. " +
        "By DEFAULT (no confirm) it returns a rendering of the goal list as it will appear — section " +
        "header, each goal with its type/target, prerequisites nested as a guide tree, and per-goal " +
        "tracking badges — plus warnings, and NO code. Show that to the user so they can adjust the " +
        "goals; re-run for an updated preview. Only once they confirm it matches their intent, call " +
        "again with the same goals and confirm:true to receive the paste-ready code. Supports simple " +
        "goals and complex prerequisite trees (wire via id + requires/orRequires).",
      inputSchema: craftShape,
    },
    async (args) => {
      const spec = args as unknown as ShareSpec & { confirm?: boolean };
      const result = buildBundle(spec);

      if (result.bundle.goals.length === 0) {
        return text("Cannot build: no goals. Add at least one goal, then try again.\n\n" + result.preview);
      }

      if (!spec.confirm) {
        return text(
          result.preview +
            "\n\n— Preview only (no code emitted). This is how the goal list will import. Adjust the goals and " +
            "re-run to update it; when it looks right, call craft_import_string again with the SAME goals and " +
            "confirm:true to get the paste-ready import code.",
        );
      }

      const code = encode(result.bundle);
      return text(
        result.preview +
          "\n\n✅ Import code (paste into RuneLite Goal Planner ▸ Import shared goals…):\n\n" +
          code,
      );
    },
  );

  server.registerTool(
    "decode_import_string",
    {
      title: "Decode a Goal Planner import string",
      description:
        "Decode a GPSHARE1: code back into a readable breakdown (section, goals, identifiers, prerequisite tree) " +
        "for verification. Tolerates surrounding text — paste the whole message containing the code.",
      inputSchema: { code: z.string().describe("A GPSHARE1: import code (may be embedded in other text).") },
    },
    async ({ code }) => {
      try {
        const bundle = decode(code);
        return text(describeBundle(bundle));
      } catch (e) {
        if (e instanceof ShareFormatError) {
          return { isError: true, content: [{ type: "text" as const, text: `Could not decode: ${e.message}` }] };
        }
        throw e;
      }
    },
  );

  server.registerTool(
    "list_supported_goals",
    {
      title: "List supported goal types",
      description:
        "Report which goal kinds the crafter auto-tracks (typed core) vs. emits as CUSTOM, plus the recognized skill names. " +
        "Use this to decide whether a requested goal will track on the recipient's account.",
      inputSchema: {},
    },
    async () => {
      const lines = [
        "Typed core (auto-tracks on import):",
        `  - ${TYPED_CORE.join(", ")}`,
        "",
        "SKILL accepts these names (case-insensitive), target by level or xp:",
        "  " + Object.values(SKILLS).join(", "),
        "",
        `BOSS accepts ${BOSSES.length} boss names (case-insensitive, e.g. "Zulrah", "TzKal-Zuk"; aliases`,
        '  like "the inferno", "jad"), KC target defaults to 1. GROUPS fan out: "GWD" → 4, "Dagannoth',
        '  Kings" → 3, "wilderness bosses", "all bosses". Unknown names emit as UNVERIFIED.',
        "",
        `ITEM_GRIND resolves item names against ${ITEM_COUNT.toLocaleString("en-US")} OSRS items (e.g. "Magic`,
        '  logs", "Abyssal whip"; nicknames like "tbow", "bp", "shadow"). Quantity target defaults to 1.',
        '  SETS, LOADOUTS and PHRASES fan out into one goal per piece: "full torva" → 3, "full masori +',
        '  tbow" → 4, "maxed melee setup" → 9 (also maxed ranged/mage). Pass an explicit itemId to skip',
        "  name resolution; an unresolvable name with no id → CUSTOM.",
        "",
        `DIARY resolves an "<Area> <Tier>" name across ${DIARY_COUNT} achievement-diary tiers (12 areas`,
        "  × Easy/Medium/Hard/Elite, e.g. \"Ardougne Elite\", \"Varrock hard diary\"; area aliases like",
        '  "Lumbridge & Draynor" / "Western Provinces"). GROUPS fan out: "all elite diaries" → 12, "all',
        '  Ardougne diaries" → 4, "all diaries" → 48. Tracks by varbit; Karamja Easy/Med/Hard by task count.',
        "",
        "Phase 2 (not yet validated — pass an explicit identifier to emit unverified, else CUSTOM fallback):",
        "  - QUEST (questName), ACCOUNT (accountMetric), COMBAT_ACHIEVEMENT (caTaskId)",
        "",
        "CUSTOM: always available; never auto-tracks (manual check-off).",
      ];
      return text(lines.join("\n"));
    },
  );

  return server;
}
