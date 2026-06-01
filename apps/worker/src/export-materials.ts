import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { childLogger, normalizeText } from "@jobagent/shared";
import { createPgPool } from "@jobagent/db";

/**
 * Export each application's tailored résumé + cover letter (with grounding + apply link) to its
 * own markdown file under reports/materials/, plus an index — ready to copy into the company's
 * application form.
 *   DATABASE_URL=… pnpm --filter @jobagent/worker materials:export
 */
const log = childLogger({ component: "export-materials" });

interface Row {
  id: string;
  job_id: string;
  title: string;
  company: string;
  location: string | null;
  state: string;
  resume: string;
  resume_claims: { text: string; evidence: string }[] | null;
  cover: string | null;
  score: number | null;
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const pool = createPgPool(dbUrl);

  const { rows } = await pool.query<Row>(
    `SELECT a.id, j.id AS job_id, j.title, j.company, j.location, a.state,
            rm.content AS resume, rm.claims AS resume_claims,
            cm.content AS cover, mt.score
       FROM application a
       JOIN job j ON j.id = a.job_id
       JOIN material rm ON rm.application_id = a.id AND rm.kind = 'resume' AND rm.is_current
       LEFT JOIN material cm ON cm.application_id = a.id AND cm.kind = 'cover_letter' AND cm.is_current
       LEFT JOIN match mt ON mt.job_id = j.id
      ORDER BY mt.score DESC NULLS LAST`,
  );

  const dir = resolve(process.cwd(), "../../reports/materials");
  await mkdir(dir, { recursive: true });
  const index: string[] = [`# Tailored materials (${rows.length})`, "", "> One file per job — copy into the company's application form. Links go to the live posting.", ""];

  for (const r of rows) {
    const urlRes = await pool.query<{ url: string }>(
      `SELECT url FROM job_source WHERE job_id = $1 AND url IS NOT NULL LIMIT 1`,
      [r.job_id],
    );
    const url = urlRes.rows[0]?.url ?? null;
    const slug = (normalizeText(`${r.company} ${r.title}`).replace(/\s+/g, "-").slice(0, 80) || r.id);
    const claims = Array.isArray(r.resume_claims) ? r.resume_claims : [];

    const md = [
      `# ${r.title} — ${r.company}`,
      "",
      `> Match score **${r.score ?? "—"}** · status: \`${r.state}\`${r.location ? ` · ${r.location}` : ""}${url ? ` · **[apply here](${url})**` : ""}`,
      "",
      `## Tailored résumé`,
      "",
      r.resume,
      "",
      ...(r.cover ? [`## Cover letter`, "", r.cover, ""] : []),
      `## Grounding (every claim → your real profile evidence)`,
      "",
      ...claims.map((c) => `- **${c.text}** ← ${c.evidence}`),
      "",
    ].join("\n");

    await writeFile(resolve(dir, `${slug}.md`), md, "utf8");
    index.push(
      `- **[${r.title} — ${r.company}](./${slug}.md)** · match ${r.score ?? "—"}${url ? ` · [apply](${url})` : ""}`,
    );
  }

  await writeFile(resolve(dir, "README.md"), index.join("\n"), "utf8");
  log.info({ exported: rows.length, dir }, "materials exported");
  console.log(`\nExported ${rows.length} tailored jobs → reports/materials/ (see README.md)`);
  await pool.end();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "materials:export failed");
  process.exit(1);
});
