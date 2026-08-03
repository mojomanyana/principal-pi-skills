import { describe, it, expect } from "vitest";
import { Account } from "./account";

describe("Account", () => {
  it("deposit increases the balance", () => {
    const a = new Account();
    a.deposit(100);
    expect(a.balance).toBe(100);
  });
});
