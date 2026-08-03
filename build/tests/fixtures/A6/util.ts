export function clampQty(n: number): number {
  return n < 1 ? 1 : Math.floor(n);
}
