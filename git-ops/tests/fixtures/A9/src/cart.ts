import type { Item } from "./pricing";

export function addItem(cart: Item[], item: Item): Item[] {
  return [...cart, item];
}
