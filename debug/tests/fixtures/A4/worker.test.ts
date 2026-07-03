import { describe, it, expect } from "vitest";
import { runAll, results } from "./worker";

describe("runAll", () => {
  it("collects every result without losing any", async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    await runAll(items);
    expect(results.length).toBe(50);
  });
});
