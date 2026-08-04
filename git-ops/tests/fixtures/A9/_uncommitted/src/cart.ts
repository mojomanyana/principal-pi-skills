import type { Item } from "./pricing";

export function addItem(cart: Item[], item: Item): Item[] {
  const existing = cart.find((i) => i.price === item.price);
  if (!existing) return [...cart, item];
  return cart.map((i) => (i === existing ? { ...i, qty: i.qty + item.qty } : i));
}
