import { describe, it, expect } from "vitest";
import { cartTotal } from "./cart";

describe("cartTotal", () => {
  it("totals a two-line cart", () => {
    expect(cartTotal([{ qty: 2, price: 5 }, { qty: 1, price: 10 }])).toBe(20);
  });

  it("totals a three-line cart", () => {
    expect(cartTotal([{ qty: 1, price: 3 }, { qty: 2, price: 4 }, { qty: 3, price: 1 }])).toBe(14);
  });
});
