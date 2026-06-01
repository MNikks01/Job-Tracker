import { z } from "zod";
import type { ApplicationState } from "@jobagent/shared";
import {
  createPgPool,
  PgApplicationRepository,
  PgAuditRepository,
  PgJobRepository,
  PgMatchRepository,
} from "@jobagent/db";
import { serve, text } from "../lib/serve";

// postgres-mcp — typed repository tools (no raw SQL exposed to agents).
const pool = createPgPool(process.env.DATABASE_URL ?? "");
const jobs = new PgJobRepository(pool);
const apps = new PgApplicationRepository(pool);
const matches = new PgMatchRepository(pool);
const audit = new PgAuditRepository(pool);

await serve("postgres", (s) => {
  s.registerTool(
    "db.jobs.query",
    {
      title: "Query jobs",
      description: "Search the canonical job store by keyword.",
      inputSchema: { query: z.string().optional(), limit: z.number().int().positive().max(50).optional() },
    },
    async ({ query, limit }) => {
      const all = await jobs.list();
      const q = (query ?? "").toLowerCase();
      const f = q ? all.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(q)) : all;
      return text(f.slice(0, limit ?? 10).map((j) => ({ id: j.id, title: j.title, company: j.company, status: j.status })));
    },
  );
  s.registerTool(
    "db.applications.list",
    {
      title: "List applications by state",
      description: "Applications in a given lifecycle state.",
      inputSchema: { state: z.string().optional() },
    },
    async ({ state }) => text(await apps.listByState((state ?? "pending_approval") as ApplicationState)),
  );
  s.registerTool(
    "db.matches.top",
    { title: "Top matches", description: "Top job matches by score.", inputSchema: { limit: z.number().int().positive().max(25).optional() } },
    async ({ limit }) => text(await matches.topMatches(limit ?? 10)),
  );
  s.registerTool(
    "db.audit.verify",
    { title: "Verify audit chain", description: "Recompute the hash-chained audit log (tamper detection).", inputSchema: {} },
    async () => text(await audit.verifyChain()),
  );
});
