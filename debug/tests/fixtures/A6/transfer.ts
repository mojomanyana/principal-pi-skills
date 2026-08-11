export interface Tx {
  debit(account: string, cents: number): Promise<void>;
  credit(account: string, cents: number): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export async function transferFunds(tx: Tx, from: string, to: string, cents: number): Promise<void> {
  await tx.debit(from, cents);
  // When credit throws, the debit above is already applied and nothing rolls it back:
  // the transaction is left open and the money has left one side only.
  await tx.credit(to, cents);
  await tx.commit();
}
