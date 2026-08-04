import { subtotal, type Item } from "./pricing";

export function total(items: Item[], taxRate: number): number {
  return subtotal(items) * (1 + taxRate);
}
