export interface CartLine {
  qty: number;
  price: number;
}

export function cartTotal(lines: CartLine[]): number {
  return lines.map((l) => l.qty * l.price).reduce((a, b) => a + b);
}
