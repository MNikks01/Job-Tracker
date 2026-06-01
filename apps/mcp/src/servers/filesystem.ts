import { z } from "zod";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { serve, text } from "../lib/serve";

// filesystem-mcp — sandboxed working files (jailed to STORAGE_ROOT). No path traversal.
const ROOT = resolve(process.env.STORAGE_ROOT ?? "./storage");
await mkdir(ROOT, { recursive: true });

function jail(p: string): string {
  const abs = resolve(ROOT, p);
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) {
    throw new Error(`path escapes sandbox: ${p}`);
  }
  return abs;
}

await serve("filesystem", (s) => {
  s.registerTool(
    "fs.list",
    { title: "List directory", description: "List files under a sandboxed path.", inputSchema: { path: z.string().default(".") } },
    async ({ path }) => text(await readdir(jail(path))),
  );
  s.registerTool(
    "fs.read",
    { title: "Read file", description: "Read a UTF-8 file from the sandbox.", inputSchema: { path: z.string() } },
    async ({ path }) => text(await readFile(jail(path), "utf8")),
  );
  s.registerTool(
    "fs.write",
    { title: "Write file", description: "Write a UTF-8 file into the sandbox.", inputSchema: { path: z.string(), content: z.string() } },
    async ({ path, content }) => {
      await writeFile(jail(path), content, "utf8");
      return text({ ok: true, path });
    },
  );
});
