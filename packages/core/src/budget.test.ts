import { describe, it, expect, vi } from "vitest";
import { BudgetGuard, estimateCostUsd } from "./budget";
import { GuardrailError } from "@jobagent/shared";

// $15 / 1M input tokens, $75 / 1M output tokens.
const pricing = { "claude-opus-4-8": { inputPerMTok: 15, outputPerMTok: 75 } };

describe("estimateCostUsd", () => {
  it("computes cost from token usage", () => {
    // 100k input + 20k output = 0.1*15 + 0.02*75 = 1.5 + 1.5 = 3.0
    expect(estimateCostUsd(pricing["claude-opus-4-8"], { inputTokens: 100_000, outputTokens: 20_000 })).toBeCloseTo(3.0, 6);
  });
});

describe("BudgetGuard", () => {
  it("records spend and fires alert exactly once past threshold", () => {
    const onAlert = vi.fn();
    const guard = new BudgetGuard({ monthlyUsdCap: 10, alertAtPct: 0.8, pricing, onAlert });
    guard.record("claude-opus-4-8", { inputTokens: 500_000, outputTokens: 0 }); // $7.5
    expect(onAlert).not.toHaveBeenCalled();
    guard.record("claude-opus-4-8", { inputTokens: 100_000, outputTokens: 0 }); // +$1.5 => $9 >= $8
    guard.record("claude-opus-4-8", { inputTokens: 1_000, outputTokens: 0 }); // still alerted
    expect(onAlert).toHaveBeenCalledOnce();
    expect(guard.spent).toBeCloseTo(9.015, 3);
  });

  it("allows an in-budget pre-flight check", () => {
    const guard = new BudgetGuard({ monthlyUsdCap: 10, alertAtPct: 0.8, pricing });
    expect(() =>
      guard.assertWithinBudget("claude-opus-4-8", { inputTokens: 100_000, outputTokens: 0 }),
    ).not.toThrow(); // $1.5 < $10
  });

  it("blocks an over-cap pre-flight check with GuardrailError", () => {
    const guard = new BudgetGuard({ monthlyUsdCap: 10, alertAtPct: 0.8, pricing });
    expect(() =>
      guard.assertWithinBudget("claude-opus-4-8", { inputTokens: 800_000, outputTokens: 0 }),
    ).toThrowError(GuardrailError); // $12 > $10
  });

  it("throws for an unpriced model", () => {
    const guard = new BudgetGuard({ monthlyUsdCap: 10, alertAtPct: 0.8, pricing });
    expect(() => guard.record("unknown", { inputTokens: 1, outputTokens: 1 })).toThrowError(
      GuardrailError,
    );
  });
});
