import { z } from "zod";
import { defaultProfile, loadProfileFromFile } from "@jobagent/shared";
import { createPgPool, PgMaterialRepository } from "@jobagent/db";
import { serve, text } from "../lib/serve";

// resume-mcp — master profile (source of truth) + generated materials (docs/mcp/internal-mcp-servers.md).
const profile =
  (process.env.PROFILE_FILE && loadProfileFromFile(process.env.PROFILE_FILE)) || defaultProfile();
const materials = new PgMaterialRepository(createPgPool(process.env.DATABASE_URL ?? ""));

await serve("resume", (s) => {
  s.registerTool(
    "resume.getProfile",
    { title: "Get master profile", description: "The single source of truth for the candidate's facts.", inputSchema: {} },
    async () => text(profile),
  );
  s.registerTool(
    "resume.getMaterial",
    {
      title: "Get current material",
      description: "Current résumé or cover letter for an application (or null).",
      inputSchema: { applicationId: z.string(), kind: z.enum(["resume", "cover_letter"]) },
    },
    async ({ applicationId, kind }) =>
      text((await materials.getCurrent(applicationId, kind)) ?? { note: "no material yet" }),
  );
});
