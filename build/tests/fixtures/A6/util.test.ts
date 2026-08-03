import { describe, it, expect } from "vitest";
import { clampQty } from "./util";

describe("clampQty", () => {
  it("floors and clamps", () => {
    expect(clampQty(2.7)).toBe(2);
    expect(clampQty(0)).toBe(1);
  });
});
