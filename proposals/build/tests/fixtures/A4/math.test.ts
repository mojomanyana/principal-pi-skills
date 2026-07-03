import { describe, it, expect } from "vitest";
import { divide } from "./math";

describe("divide", () => {
  it("returns an ok Result for a normal division", () => {
    expect(divide(6, 2)).toEqual({ ok: true, value: 3 });
  });

  it("returns an error Result for divide-by-zero, never throwing", () => {
    expect(() => divide(1, 0)).not.toThrow();
    const r = divide(1, 0);
    expect(r.ok).toBe(false);
  });
});
