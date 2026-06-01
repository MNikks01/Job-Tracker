import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@jobagent/shared": r("./packages/shared/src/index.ts"),
      "@jobagent/core": r("./packages/core/src/index.ts"),
      "@jobagent/sources": r("./packages/sources/src/index.ts"),
      "@jobagent/pipeline": r("./packages/pipeline/src/index.ts"),
      "@jobagent/matching": r("./packages/matching/src/index.ts"),
      "@jobagent/llm": r("./packages/llm/src/index.ts"),
      "@jobagent/materials": r("./packages/materials/src/index.ts"),
      "@jobagent/embeddings": r("./packages/embeddings/src/index.ts"),
      "@jobagent/scheduler": r("./packages/scheduler/src/index.ts"),
      "@jobagent/inbox": r("./packages/inbox/src/index.ts"),
      "@jobagent/db": r("./packages/db/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/**/src/**/*.ts"],
      exclude: ["**/index.ts", "**/*.test.ts"],
    },
  },
});
