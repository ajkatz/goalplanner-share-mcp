// End-to-end MCP smoke test: spawn the built stdio server and drive it as a real client.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";

const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js"] });
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log("tools:", names.join(", "));
assert.deepEqual(names, ["craft_import_string", "decode_import_string", "list_supported_goals"]);

const goals = [
  { id: "zuk", type: "boss", name: "Beat the Inferno", bossName: "TzKal-Zuk", targetValue: 1, requires: ["range", "def", "jad"] },
  { id: "jad", type: "boss", name: "Beat the Fight Caves", bossName: "TzTok-Jad", targetValue: 1 },
  { id: "range", type: "skill", skill: "Ranged", level: 90 },
  { id: "def", type: "skill", skill: "Defence", level: 70 },
];

// Phase 1: preview only — must NOT contain a code.
const preview = await client.callTool({ name: "craft_import_string", arguments: { mode: "section", sectionName: "Inferno prep", goals } });
const previewText = preview.content[0].text;
console.log("\n--- preview ---\n" + previewText);
assert.ok(!previewText.includes("GPSHARE1:"), "preview must not emit a code");
assert.ok(previewText.includes("Preview only"));

// Phase 2: confirm — must contain a code.
const built = await client.callTool({ name: "craft_import_string", arguments: { mode: "section", sectionName: "Inferno prep", goals, confirm: true } });
const builtText = built.content[0].text;
const code = builtText.match(/GPSHARE1:[A-Za-z0-9_-]+/)?.[0];
assert.ok(code, "confirm must emit a GPSHARE1: code");
console.log("\ncode:", code);

// Round-trip: decode the emitted code.
const decoded = await client.callTool({ name: "decode_import_string", arguments: { code: `please import: ${code}` } });
const decodedText = decoded.content[0].text;
console.log("\n--- decoded ---\n" + decodedText);
assert.ok(decodedText.includes("Inferno prep"));
assert.ok(decodedText.includes("skill=RANGED"));
assert.ok(decodedText.includes("Beat the Inferno"));
assert.ok(decodedText.includes("boss=TzTok-Jad"), "Jad prereq should be present");
assert.ok(decodedText.includes("boss=TzKal-Zuk"), "Zuk goal should be present");

await client.close();
console.log("\nSMOKE_OK");
