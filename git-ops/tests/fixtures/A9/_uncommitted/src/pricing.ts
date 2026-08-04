export interface Item {
  price: number;
  qty: number;
}

export function subtotal(items: Item[]): number {
<<<<<<< HEAD
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
=======
  return items.reduce((sum, i) => sum + Math.round(i.price * i.qty * 100) / 100, 0);
>>>>>>> origin/rounding-fix
}
