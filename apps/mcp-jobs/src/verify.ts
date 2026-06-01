import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Real MCP handshake verification: spawn the server over stdio, list its tools, and call
 * each — proving the MCP boundary works end-to-end (against the live Postgres data).
 *   DATABASE_URL=… pnpm --filter @jobagent/mcp-jobs verify
 */
const here = dirname(fileURLToPath(import.meta.url)); // apps/mcp-jobs/src
const serverPath = resolve(here, "server.ts");
const tsxBin = resolve(here, "../../../node_modules/.bin/tsx");

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: tsxBin,
    args: [serverPath],
    env: { ...process.env } as Record<string, string>,
  });
  const client = new Client({ name: "mcp-verify", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log("=== MCP handshake OK — tools advertised ===");
  for (const t of tools) console.log(`  • ${t.name} — ${t.description}`);

  console.log("\n=== call jobs.search { query: 'backend', limit: 3 } ===");
  const r1 = await client.callTool({ name: "jobs.search", arguments: { query: "backend", limit: 3 } });
  console.log((r1.content as { type: string; text: string }[])[0]?.text);

  console.log("\n=== call matches.top { limit: 3 } ===");
  const r2 = await client.callTool({ name: "matches.top", arguments: { limit: 3 } });
  const top = JSON.parse((r2.content as { type: string; text: string }[])[0]?.text ?? "[]");
  for (const m of top) console.log(`  [${m.score}] ${m.title} (${m.company})`);

  await client.close();
  console.log("\n✅ MCP server verified over stdio.");
}

main().catch((err) => {
  console.error("verify failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
