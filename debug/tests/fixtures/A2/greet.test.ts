import { describe, it, expect } from "vitest";
import { greet } from "./greet";

describe("greet", () => {
  it("greets a known user", () => {
    expect(greet(1)).toBe("Hi ANN");
  });

  it("does not crash when the user is missing", () => {
    expect(() => greet(99)).not.toThrow();
  });
});
