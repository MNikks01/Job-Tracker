import { GuardrailError } from "@jobagent/shared";

/**
 * BudgetGuard (NFR-08, FR-901): wraps every LLM call. Tracks spend against a hard
 * monthly cap, alerts at a threshold, and throws GuardrailError when the cap is reached
 * so the orchestrator can pause non-critical LLM work.
 *
 * Pricing is injected per-model (USD per 1M tokens). Spend tracking here is in-memory for
 * tests; production persists to Postgres/Redis keyed by month.
 */
export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface BudgetGuardOptions {
  monthlyUsdCap: number;
  alertAtPct: number; // 0..1
  pricing: Record<string, ModelPricing>;
  onAlert?: (info: { spentUsd: number; capUsd: number; pct: number }) => void;
}

export function estimateCostUsd(pricing: ModelPricing, usage: Usage): number {
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok
  );
}

export class BudgetGuard {
  private spentUsd = 0;
  private alerted = false;

  constructor(private readonly opts: BudgetGuardOptions) {}

  get spent(): number {
    return this.spentUsd;
  }

  /** Pre-flight check using an estimated cost. Throws if it would exceed the cap. */
  assertWithinBudget(model: string, estimate: Usage): void {
    const pricing = this.pricingFor(model);
    const projected = this.spentUsd + estimateCostUsd(pricing, estimate);
    if (projected > this.opts.monthlyUsdCap) {
      throw new GuardrailError("LLM budget cap reached", {
        spentUsd: this.spentUsd,
        capUsd: this.opts.monthlyUsdCap,
        model,
      });
    }
  }

  /** Record actual usage after a call; fires the alert callback once past the threshold. */
  record(model: string, usage: Usage): number {
    const cost = estimateCostUsd(this.pricingFor(model), usage);
    this.spentUsd += cost;
    const pct = this.spentUsd / this.opts.monthlyUsdCap;
    if (!this.alerted && pct >= this.opts.alertAtPct) {
      this.alerted = true;
      this.opts.onAlert?.({ spentUsd: this.spentUsd, capUsd: this.opts.monthlyUsdCap, pct });
    }
    return cost;
  }

  private pricingFor(model: string): ModelPricing {
    const p = this.opts.pricing[model];
    if (!p) {
      throw new GuardrailError(`No pricing configured for model: ${model}`, { model });
    }
    return p;
  }
}
