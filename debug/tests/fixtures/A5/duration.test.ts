import { describe, expect, it } from "vitest";
import { parseDuration } from "./duration";

describe("parseDuration", () => {
  it("parses valid durations", () => {
    expect(parseDuration("30s")).toBe(30_000);
    expect(parseDuration("5m")).toBe(300_000);
  });

  it("reports malformed input in a way the caller can act on", () => {
    // A raw TypeError from an internal null-deref is not an answer. Either a typed
    // error or a checked result is fine — this asserts only that the failure is
    // intelligible, not which shape the fix takes.
    let described = false;
    try {
      const result = parseDuration("banana") as unknown;
      described = result !== undefined && result !== null && !Number.isNaN(result as number);
    } catch (e) {
      described = e instanceof Error && !/Cannot read|undefined|null/i.test(e.message);
    }
    expect(described).toBe(true);
  });
});
