import { describe, it, expect } from "vitest";
import { createAdapter, createEnabledAdapters } from "./factory";
import { SourceConfigSchema, FatalError } from "@jobagent/shared";

const cfg = (over: Record<string, unknown>) => SourceConfigSchema.parse(over);

describe("createAdapter", () => {
  it("builds a greenhouse adapter", () => {
    const a = createAdapter(cfg({ key: "gh", kind: "greenhouse", options: { board: "acme" } }));
    expect(a.kind).toBe("greenhouse");
    expect(a.key).toBe("greenhouse:acme");
  });

  it("builds a lever adapter", () => {
    const a = createAdapter(cfg({ key: "lv", kind: "lever", options: { handle: "acme" } }));
    expect(a.kind).toBe("lever");
  });

  it("builds an rss adapter", () => {
    const a = createAdapter(
      cfg({ key: "rss", kind: "rss", options: { url: "https://acme.com/f.rss", company: "Acme" } }),
    );
    expect(a.kind).toBe("rss");
  });

  it("throws FatalError on invalid options", () => {
    expect(() => createAdapter(cfg({ key: "gh", kind: "greenhouse", options: {} }))).toThrowError(
      FatalError,
    );
  });

  it("throws FatalError for an unimplemented kind", () => {
    expect(() =>
      createAdapter(cfg({ key: "b", kind: "browser", options: {} })),
    ).toThrowError(FatalError);
  });
});

describe("createEnabledAdapters", () => {
  it("builds only enabled sources", () => {
    const sources = [
      cfg({ key: "gh", kind: "greenhouse", enabled: true, options: { board: "acme" } }),
      cfg({ key: "lv", kind: "lever", enabled: false, options: { handle: "x" } }),
    ];
    const adapters = createEnabledAdapters(sources);
    expect(adapters).toHaveLength(1);
    expect(adapters[0]!.key).toBe("greenhouse:acme");
  });
});
