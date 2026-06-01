import { serve, text } from "../lib/serve";

// linkedin-mcp — feature-flagged OFF by default (ToS compliance, ADR-004 / docs/mcp).
await serve("linkedin", (s) => {
  s.registerTool(
    "linkedin.status",
    { title: "LinkedIn integration status", description: "Reports whether LinkedIn tools are enabled.", inputSchema: {} },
    async () =>
      text({
        enabled: false,
        reason:
          "Disabled by default for ToS compliance. Enable only with explicit operator acknowledgement; read-only + conservative rate limits when on. No member scraping, no messaging automation.",
      }),
  );
});
