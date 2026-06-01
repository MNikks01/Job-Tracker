import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { childLogger } from "@jobagent/shared";
import { createPgPool } from "@jobagent/db";

/**
 * Application tracker (FR-501/503): every applied job with its age + a follow-up flag for
 * stalled ones (no movement past STALL_DAYS). Writes reports/tracker.md.
 *   DATABASE_URL=… STALL_DAYS=7 pnpm --filter @jobagent/worker track:report
 */
const log = childLogger({ component: "track-report" });

interface Row {
  title: string;
  company: string;
  state: string;
  submitted_at: Date | null;
  url: string | null;
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const stallDays = Number(process.env.STALL_DAYS ?? "7");
  const pool = createPgPool(dbUrl);

  const { rows } = await pool.query<Row>(
    `SELECT DISTINCT ON (a.id) j.title, j.company, a.state, a.submitted_at,
            (SELECT url FROM job_source js WHERE js.job_id = j.id AND js.url IS NOT NULL LIMIT 1) AS url
       FROM application a
       JOIN job j ON j.id = a.job_id
      WHERE a.state IN ('applied','responded','interview_scheduled','interviewed','offer')
      ORDER BY a.id, a.submitted_at DESC NULLS LAST`,
  );

  const now = Date.now();
  const enriched = rows
    .map((r) => {
      const ageDays = r.submitted_at ? Math.floor((now - new Date(r.submitted_at).getTime()) / 86_400_000) : null;
      const followUp = r.state === "applied" && ageDays != null && ageDays >= stallDays;
      return { ...r, ageDays, followUp };
    })
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));

  const followUps = enriched.filter((e) => e.followUp).length;
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
  const lines = [
    `# Application tracker`,
    ``,
    `> Generated ${nowStr} UTC · **${enriched.length}** active applications · **${followUps}** need a follow-up (≥ ${stallDays} days, no response).`,
    ``,
    `| Follow-up? | Age (days) | Status | Title | Company | Link |`,
    `|:----------:|----------:|--------|-------|---------|------|`,
    ...enriched.map(
      (e) =>
        `| ${e.followUp ? "⚠️ yes" : ""} | ${e.ageDays ?? "—"} | ${e.state} | ${esc(e.title)} | ${esc(e.company)} | ${e.url ? `[open](${e.url})` : "—"} |`,
    ),
    ``,
  ];

  const dir = resolve(process.cwd(), "../../reports");
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "tracker.md"), lines.join("\n"), "utf8");
  log.info({ active: enriched.length, followUps }, "tracker written");
  console.log(`\nTracker: ${enriched.length} active applications, ${followUps} need follow-up → reports/tracker.md`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "track:report failed");
  process.exit(1);
});
