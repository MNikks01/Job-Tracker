import { describe, it, expect } from "vitest";
import { assertTransition, canTransition, nextStates } from "./state-machine";
import { GuardrailError } from "@jobagent/shared";

describe("application state machine (FR-501)", () => {
  it("allows the happy path discovered → … → applied", () => {
    expect(canTransition("discovered", "matched")).toBe(true);
    expect(canTransition("matched", "materials_drafted")).toBe(true);
    expect(canTransition("materials_drafted", "pending_approval")).toBe(true);
    expect(canTransition("pending_approval", "applied")).toBe(true);
    expect(canTransition("applied", "responded")).toBe(true);
  });

  it("permits archive from any active state", () => {
    expect(canTransition("pending_approval", "archived")).toBe(true);
    expect(canTransition("offer", "archived")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("discovered", "applied")).toBe(false);
    expect(canTransition("applied", "pending_approval")).toBe(false);
    expect(() => assertTransition("discovered", "applied")).toThrowError(GuardrailError);
  });

  it("supports HITL branches from pending_approval", () => {
    expect(nextStates("pending_approval")).toEqual(
      expect.arrayContaining(["applied", "rejected_by_user", "snoozed", "needs_manual"]),
    );
  });

  it("snoozed returns to the queue", () => {
    expect(canTransition("snoozed", "pending_approval")).toBe(true);
  });

  it("archived is terminal", () => {
    expect(nextStates("archived")).toEqual([]);
  });
});
