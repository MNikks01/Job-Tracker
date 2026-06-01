import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { childLogger } from "@jobagent/shared";
import { createPgPool } from "@jobagent/db";

/**
 * Generate a markdown report of jobs from the new remote boards (RemoteOK / Remotive /
 * WeWorkRemotely), with match score, rationale, and apply links — for human review.
 *   DATABASE_URL=… pnpm --filter @jobagent/worker report:jobs
 */
const log = childLogger({ component: "report-jobs" });

interface Row {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string;
  url: string | null;
  posted_at: Date | null;
  score: number | null;
  confidence: number | null;
  rationale: string | null;
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
const sourceLabel = (k: string) =>
  k.startsWith("weworkremotely") ? "WeWorkRemotely" : k === "remoteok" ? "RemoteOK" : k.startsWith("remotive") ? "Remotive" : k;

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const minScore = Number(process.env.MIN_SCORE ?? "0");
  const pool = createPgPool(dbUrl);

  const { rows } = await pool.query<Row>(
    `SELECT DISTINCT ON (j.id)
            j.id, j.title, j.company, j.location, s.key AS source, js.url, j.posted_at,
            m.score, m.confidence, m.rationale
       FROM job j
       JOIN job_source js ON js.job_id = j.id
       JOIN source s ON s.id = js.source_id
       LEFT JOIN match m ON m.job_id = j.id
      WHERE (s.key = 'remoteok' OR s.key LIKE 'remotive%' OR s.key LIKE 'weworkremotely%')
        AND COALESCE(m.score, 0) >= $1
      ORDER BY j.id, m.score DESC NULLS LAST`,
    [minScore],
  );

  // Group by source, sort each by score desc.
  const bySource = new Map<string, Row[]>();
  for (const r of rows) {
    const label = sourceLabel(r.source);
    (bySource.get(label) ?? bySource.set(label, []).get(label)!).push(r);
  }
  for (const list of bySource.values()) list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const lines: string[] = [
    `# Newly discovered remote jobs`,
    ``,
    `> Generated ${now} UTC · sources: RemoteOK, Remotive, WeWorkRemotely · ranked by match score (0–100) vs. your profile.`,
    `> Total: **${rows.length}** jobs${minScore > 0 ? ` (score ≥ ${minScore})` : ""}.`,
    ``,
  ];

  for (const [label, list] of [...bySource.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`## ${label} — ${list.length} jobs`, ``);
    lines.push(`| Score | Conf | Title | Company | Location | Posted | Apply | Why |`);
    lines.push(`|------:|-----:|-------|---------|----------|--------|-------|-----|`);
    for (const r of list) {
      const apply = r.url ? `[open](${r.url})` : "—";
      const posted = r.posted_at ? new Date(r.posted_at).toISOString().slice(0, 10) : "—";
      lines.push(
        `| ${r.score ?? "—"} | ${r.confidence ?? "—"} | ${esc(r.title)} | ${esc(r.company)} | ${esc(r.location ?? "—")} | ${posted} | ${apply} | ${esc(r.rationale ?? "")} |`,
      );
    }
    lines.push(``);
  }

  const dir = resolve(process.cwd(), "../../reports");
  await mkdir(dir, { recursive: true });
  const out = resolve(dir, "new-jobs.md");
  await writeFile(out, lines.join("\n"), "utf8");
  log.info({ jobs: rows.length, file: out }, "report written");
  console.log(`\nWrote ${rows.length} jobs → reports/new-jobs.md`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "report:jobs failed");
  process.exit(1);
});
