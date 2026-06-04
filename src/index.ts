#!/usr/bin/env node
/**
 * Entrypoint: start the stdio MCP server. Register in your client (e.g. Claude)
 * with command `node /path/to/dist/index.js` (or `goalplanner-share-mcp` once
 * installed). Logs go to stderr so they never corrupt the stdio protocol.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("goalplanner-share-mcp: listening on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`goalplanner-share-mcp: fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
