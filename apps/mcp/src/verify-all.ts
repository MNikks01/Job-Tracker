import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Verify every MCP server via a real MCP client: spawn over stdio, handshake, list tools,
 * call one sample tool. OAuth-bound tools intentionally return needs_setup.
 *   DATABASE_URL=… SOURCES_FILE=$(pwd)/config/sources.json pnpm --filter @jobagent/mcp verify
 */
const here = dirname(fileURLToPath(import.meta.url)); // apps/mcp/src
const tsxBin = resolve(here, "../../../node_modules/.bin/tsx");
const srv = (f: string) => resolve(here, "servers", f);

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const targets: { name: string; file: string; tool: string; args: Record<string, unknown> }[] = [
  { name: "resume", file: "resume.ts", tool: "resume.getProfile", args: {} },
  { name: "postgres", file: "postgres.ts", tool: "db.matches.top", args: { limit: 2 } },
  { name: "filesystem", file: "filesystem.ts", tool: "fs.list", args: { path: "." } },
  { name: "calendar", file: "calendar.ts", tool: "calendar.proposeSlots", args: { fromISO: inDays(1), toISO: inDays(6), durationMin: 30, tz: "Asia/Kolkata", count: 2 } },
  { name: "gmail", file: "gmail.ts", tool: "gmail.classify", args: { subject: "Next steps", body: "Can we schedule a technical interview?" } },
  { name: "jobboards", file: "jobboards.ts", tool: "jobboards.listSources", args: {} },
  { name: "redis", file: "redis.ts", tool: "cache.set", args: { key: "mcp:verify", value: "ok", ttlSec: 60 } },
  { name: "linkedin", file: "linkedin.ts", tool: "linkedin.status", args: {} },
];

async function verifyOne(t: (typeof targets)[number]): Promise<void> {
  const transport = new StdioClientTransport({
    command: tsxBin,
    args: [srv(t.file)],
    env: { ...process.env } as Record<string, string>,
  });
  const client = new Client({ name: "mcp-verify", version: "0.1.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const res = await client.callTool({ name: t.tool, arguments: t.args });
    const out = (res.content as { type: string; text: string }[])[0]?.text ?? "";
    const firstLine = out.split("\n").slice(0, 1).join(" ").slice(0, 90);
    console.log(`✅ ${t.name.padEnd(11)} tools=[${tools.map((x) => x.name).join(", ")}]`);
    console.log(`     ${t.tool} → ${firstLine}${out.length > 90 ? " …" : ""}`);
  } catch (err) {
    console.log(`❌ ${t.name.padEnd(11)} ${err instanceof Error ? err.message : err}`);
  } finally {
    await client.close().catch(() => {});
  }
}

console.log("=== Verifying MCP servers over stdio ===");
for (const t of targets) await verifyOne(t);
console.log("\nDone.");
