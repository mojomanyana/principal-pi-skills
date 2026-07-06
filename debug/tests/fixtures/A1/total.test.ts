import { describe, it, expect } from "vitest";
import { runningTotal } from "./total";

describe("runningTotal", () => {
  it("sums the numbers", () => {
    expect(runningTotal([1, 2, 3])).toBe(6);
  });
});
