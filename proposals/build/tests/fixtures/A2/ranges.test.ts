import { describe, it, expect } from "vitest";
import { sliceRange } from "./ranges";

describe("sliceRange", () => {
  it("includes the end index", () => {
    expect(sliceRange([10, 20, 30, 40], 1, 3)).toEqual([20, 30, 40]);
  });
});
