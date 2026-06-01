import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPgPool, PgJobRepository, PgMatchRepository } from "@jobagent/db";

/**
 * Reference MCP server (ADR-004) — exposes our internal job tools over the Model Context
 * Protocol so external MCP clients (Claude Desktop, Cursor, Claude Code) can use them. It
 * wraps the SAME typed repositories the orchestrator uses; the protocol is the boundary.
 *
 * IMPORTANT: stdio transport requires stdout to carry ONLY JSON-RPC — so this process must
 * not print to stdout (no logger). Errors go to stderr, which is safe.
 *
 * Run: DATABASE_URL=… pnpm --filter @jobagent/mcp-jobs start   (usually launched by a client)
 */
const pool = createPgPool(process.env.DATABASE_URL ?? "");
const jobsRepo = new PgJobRepository(pool);
const matchRepo = new PgMatchRepository(pool);

const server = new McpServer({ name: "jobagent-jobs", version: "0.1.0" });

server.registerTool(
  "jobs.search",
  {
    title: "Search discovered jobs",
    description: "Search the canonical job store by keyword (title/company). Returns normalized jobs.",
    inputSchema: {
      query: z.string().optional().describe("case-insensitive substring of title or company"),
      limit: z.number().int().positive().max(50).optional(),
    },
  },
  async ({ query, limit }) => {
    const all = await jobsRepo.list();
    const q = (query ?? "").toLowerCase();
    const filtered = q
      ? all.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(q))
      : all;
    const rows = filtered.slice(0, limit ?? 10).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location ?? null,
      remote: j.remote ?? null,
      status: j.status,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ count: rows.length, jobs: rows }, null, 2) }],
    };
  },
);

server.registerTool(
  "matches.top",
  {
    title: "Top profile matches",
    description: "Top job matches against the master profile, ranked by score with rationale.",
    inputSchema: { limit: z.number().int().positive().max(25).optional() },
  },
  async ({ limit }) => {
    const top = await matchRepo.topMatches(limit ?? 10);
    return { content: [{ type: "text", text: JSON.stringify(top, null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
