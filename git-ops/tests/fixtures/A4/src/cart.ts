export interface CartLine {
  sku: string;
  qty: number;
  unitCents: number;
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0);
}
