import { describe, it, expect } from "vitest";
import { isEven } from "./parity";

describe("isEven", () => {
  it("is true for even numbers", () => {
    expect(isEven(4)).toBe(true);
  });

  it("is false for odd numbers", () => {
    expect(isEven(3)).toBe(false);
  });
});
