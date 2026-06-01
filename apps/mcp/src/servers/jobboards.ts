import { z } from "zod";
import { defaultSeedConfig, loadSourcesFromFile } from "@jobagent/shared";
import { createEnabledAdapters } from "@jobagent/sources";
import { serve, text } from "../lib/serve";

// jobboards-mcp — discovery via compliant source adapters. Apply is gated (not exposed here).
const sources =
  (process.env.SOURCES_FILE && loadSourcesFromFile(process.env.SOURCES_FILE)) || defaultSeedConfig().sources;
const adapters = createEnabledAdapters(sources);

await serve("jobboards", (s) => {
  s.registerTool(
    "jobboards.listSources",
    { title: "List enabled sources", description: "Enabled job sources + capabilities.", inputSchema: {} },
    async () => text(adapters.map((a) => ({ key: a.key, kind: a.kind, supportsApply: a.supportsApply }))),
  );
  s.registerTool(
    "jobboards.discover",
    {
      title: "Discover postings",
      description: "Fetch postings from one enabled source (rate-limited, ToS-compliant).",
      inputSchema: { sourceKey: z.string() },
    },
    async ({ sourceKey }) => {
      const a = adapters.find((x) => x.key === sourceKey);
      if (!a) return text({ error: "unknown/disabled source", available: adapters.map((x) => x.key) });
      const r = await a.discover({});
      return text({
        source: a.key,
        count: r.postings.length,
        sample: r.postings.slice(0, 5).map((p) => ({ title: p.title, company: p.company, location: p.location })),
      });
    },
  );
});
