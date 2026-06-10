// Regenerate src/refdata/quests.data.ts from the RuneLite API Quest enum.
//
// The plugin's QuestTracker does `Quest.valueOf(goal.getQuestName())`, so a
// QUEST goal auto-tracks ONLY when `questName` is the exact RuneLite enum
// CONSTANT name (e.g. DRAGON_SLAYER_I), not the display name. This generator
// runs the real enum (values()/name()/getId()/getName()) from the same
// runelite-api jar the plugin builds against — no source parsing, so the
// constant↔display pairing can't drift from what Quest.valueOf accepts.
//
// Usage: npm run gen:quests
//   RUNELITE_API_JAR=/path/to/runelite-api-X.Y.Z.jar  (override; else the
//     newest non-sources runelite-api jar in ~/.gradle/caches is used)
//   JAVA_HOME=/path/to/jdk  (else zulu-21, else `java` on PATH)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function discoverJar() {
  if (process.env.RUNELITE_API_JAR) return { jar: process.env.RUNELITE_API_JAR, version: "env-override" };
  const root = join(homedir(), ".gradle/caches/modules-2/files-2.1/net.runelite/runelite-api");
  if (!existsSync(root)) throw new Error(`no gradle cache at ${root} — set RUNELITE_API_JAR`);
  const versions = readdirSync(root).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  for (const v of versions.reverse()) {
    for (const hash of readdirSync(join(root, v))) {
      const jar = join(root, v, hash, `runelite-api-${v}.jar`);
      if (existsSync(jar)) return { jar, version: v };
    }
  }
  throw new Error(`no runelite-api jar found under ${root} — set RUNELITE_API_JAR`);
}

function javaBin() {
  const home = process.env.JAVA_HOME || "/Library/Java/JavaVirtualMachines/zulu-21.jdk/Contents/Home";
  const candidate = join(home, "bin/java");
  return existsSync(candidate) ? candidate : "java";
}

const { jar, version } = discoverJar();
const work = mkdtempSync(join(tmpdir(), "gen-quests-"));
try {
  const dump = join(work, "QuestDump.java");
  writeFileSync(
    dump,
    `import net.runelite.api.Quest;
public class QuestDump {
    public static void main(String[] args) {
        for (Quest q : Quest.values()) {
            System.out.println(q.name() + "\\t" + q.getId() + "\\t" + q.getName());
        }
    }
}
`,
  );
  const out = execFileSync(javaBin(), ["-cp", jar, dump], { encoding: "utf8" });
  const quests = out
    .trim()
    .split("\n")
    .map((line) => {
      const [enumName, questId, displayName] = line.split("\t");
      if (!enumName || !displayName || Number.isNaN(Number(questId))) {
        throw new Error(`malformed dump line: ${JSON.stringify(line)}`);
      }
      return { enumName, questId: Number(questId), displayName };
    })
    .sort((a, b) => a.enumName.localeCompare(b.enumName));
  if (quests.length < 150) throw new Error(`only ${quests.length} quests dumped — expected 200+, refusing to emit`);

  const header = `/**
 * Quest reference data — RuneLite \`net.runelite.api.Quest\` enum constants.
 * The recipient's QuestTracker does \`Quest.valueOf(questName)\`, so a QUEST
 * goal auto-tracks ONLY when \`questName\` is the exact CONSTANT name
 * (e.g. "DRAGON_SLAYER_I"), never the display name. Includes miniquests
 * (QuestState resolves them the same way).
 *
 * GENERATED — do not hand-edit. Regenerate with \`npm run gen:quests\` (runs the
 * enum from the local runelite-api jar; see scripts/gen-quests.mjs).
 * Source: runelite-api ${version} (${quests.length} quests).
 */

export interface QuestRef {
  /** Quest enum constant — the value \`questName\` must carry on the wire. */
  enumName: string;
  /** RuneLite quest id (informational; not used for tracking). */
  questId: number;
  /** In-game display name. */
  displayName: string;
}

export const QUESTS: readonly QuestRef[] = [
`;
  const body = quests
    .map((q) => `  { enumName: ${JSON.stringify(q.enumName)}, questId: ${q.questId}, displayName: ${JSON.stringify(q.displayName)} },`)
    .join("\n");
  const file = `${header}${body}\n];\n\nexport const QUEST_COUNT = QUESTS.length;\n`;
  const dest = join(here, "..", "src/refdata/quests.data.ts");
  writeFileSync(dest, file);
  console.log(`wrote ${dest}: ${quests.length} quests from runelite-api ${version}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
