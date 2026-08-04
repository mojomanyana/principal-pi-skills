import { subtotal, type Item } from "./pricing";

export function total(items: Item[], taxRate: number): number {
<<<<<<< HEAD
  return subtotal(items) * (1 + taxRate);
=======
  const net = subtotal(items);
  return net + net * taxRate;
>>>>>>> origin/rounding-fix
}
