export class Account {
  balance = 0;

  deposit(amount: number): void {
    this.balance += amount;
  }
}
