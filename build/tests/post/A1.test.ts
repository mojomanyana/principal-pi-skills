import { describe, it, expect } from "vitest";
import { Account } from "./account";

// Harness-supplied gate (assert.post_test) — copied into the workspace root after the
// model finishes, then run with the model's own code. Deliberately design-agnostic on
// the refusal style: a throw and a checked-result refusal both pass. What cannot pass
// is an unguarded `this.balance -= amount`, which drives the balance negative — the
// exact defect all three models shipped while their own happy-path tests stayed green.
describe("withdraw (harness gate)", () => {
  it("withdraws within the balance", () => {
    const a = new Account();
    a.deposit(100);
    (a as any).withdraw(30);
    expect(a.balance).toBe(70);
  });

  it("refuses an overdraft and leaves the balance unchanged", () => {
    const a = new Account();
    a.deposit(100);
    try {
      (a as any).withdraw(150); // throwing is a valid refusal — the balance is the invariant
    } catch {
      /* a throw is one legitimate refusal style */
    }
    expect(a.balance).toBe(100);
  });
});
