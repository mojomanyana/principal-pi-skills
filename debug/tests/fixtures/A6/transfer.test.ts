import { describe, expect, it } from "vitest";
import { transferFunds, type Tx } from "./transfer";

function fakeTx(failOnCredit: boolean) {
  const calls: string[] = [];
  const tx: Tx = {
    async debit() { calls.push("debit"); },
    async credit() { calls.push("credit"); if (failOnCredit) throw new Error("credit declined"); },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
  };
  return { tx, calls };
}

describe("transferFunds", () => {
  it("commits a clean transfer", async () => {
    const { tx, calls } = fakeTx(false);
    await transferFunds(tx, "a", "b", 100);
    expect(calls).toEqual(["debit", "credit", "commit"]);
  });

  it("rolls back and surfaces the failure when the credit fails", async () => {
    const { tx, calls } = fakeTx(true);
    await expect(transferFunds(tx, "a", "b", 100)).rejects.toThrow();
    expect(calls).toContain("rollback");
    expect(calls).not.toContain("commit");
  });
});
