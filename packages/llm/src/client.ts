import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BudgetGuard } from "@jobagent/core";
import { childLogger, GuardrailError } from "@jobagent/shared";

const log = childLogger({ component: "llm" });

/** Anthropic pricing (USD / 1M tokens) for the BudgetGuard. */
export const DEFAULT_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "claude-haiku-4-5-20251001": { inputPerMTok: 1, outputPerMTok: 5 },
};

/** Minimal interface materials/agents depend on — lets tests inject a mock LLM. */
export interface StructuredGenerator {
  generateStructured<T extends z.ZodTypeAny>(opts: GenerateOptions<T>): Promise<z.infer<T>>;
}

export interface GenerateOptions<T extends z.ZodTypeAny> {
  model: string;
  /** Stable, cacheable prefix (instructions + master profile) — cached across calls. */
  system: string;
  /** Per-request content (the job posting, the material under review, etc.). */
  user: string;
  /** Zod schema for client-side validation of the structured response. */
  schema: T;
  /** Hand-written JSON Schema enforced by the API (output_format). */
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * LlmClient — thin wrapper over the Anthropic SDK that:
 *  - enforces the BudgetGuard (NFR-08) on every call,
 *  - caches the stable system prefix (master profile) to cut cost (prompt caching),
 *  - returns schema-validated structured output (no brittle text parsing).
 *
 * Uses the beta structured-outputs surface (`beta.messages.parse` + `betaZodOutputFormat`)
 * available in the installed SDK; the beta header is set by the SDK automatically.
 */
export class LlmClient implements StructuredGenerator {
  private readonly client: Anthropic;

  constructor(
    private readonly budget: BudgetGuard,
    apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
  ) {
    if (!apiKey) throw new GuardrailError("ANTHROPIC_API_KEY is not set");
    this.client = new Anthropic({ apiKey });
  }

  async generateStructured<T extends z.ZodTypeAny>(opts: GenerateOptions<T>): Promise<z.infer<T>> {
    const maxTokens = opts.maxTokens ?? 6000;
    const estInput = Math.ceil((opts.system.length + opts.user.length) / 4);
    this.budget.assertWithinBudget(opts.model, { inputTokens: estInput, outputTokens: maxTokens });

    // output_format the SDK can parse: a json_schema object plus a `parse` callback that
    // validates with our zod schema (mirrors what betaZodOutputFormat produces, minus the
    // zod-v4 toJSONSchema dependency).
    const outputFormat = {
      type: "json_schema" as const,
      schema: opts.jsonSchema,
      parse: (content: string) => opts.schema.parse(JSON.parse(content)),
    };

    const res = await this.client.beta.messages.parse({
      model: opts.model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      output_format: outputFormat as any,
      messages: [{ role: "user", content: opts.user }],
    });

    const u = res.usage;
    const inputTokens =
      u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    this.budget.record(opts.model, { inputTokens, outputTokens: u.output_tokens });
    log.info(
      {
        model: opts.model,
        inputTokens: u.input_tokens,
        cacheRead: u.cache_read_input_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        outputTokens: u.output_tokens,
        spentUsd: Number(this.budget.spent.toFixed(4)),
      },
      "llm call",
    );

    const parsed = (res as { parsed_output?: unknown }).parsed_output;
    if (parsed == null) {
      throw new GuardrailError("LLM returned no parsed output", { stopReason: res.stop_reason });
    }
    return parsed as z.infer<T>;
  }
}
