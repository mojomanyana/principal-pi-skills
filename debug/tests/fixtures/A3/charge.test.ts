import { describe, it, expect } from "vitest";
import { charge } from "./charge";

function makeOrder(total: number) {
  return {
    total,
    paidId: null as string | null,
    markPaid(id: string) {
      this.paidId = id;
    },
  };
}

describe("charge", () => {
  it("marks a successful order paid", () => {
    const o = makeOrder(50);
    charge(o);
    expect(o.paidId).toBe("tx_50");
  });

  it("does not crash the caller when the gateway fails", () => {
    const o = makeOrder(500);
    expect(() => charge(o)).not.toThrow();
    // the failure must be detectable: a failed charge is NOT marked paid
    expect(o.paidId).toBeNull();
  });
});
