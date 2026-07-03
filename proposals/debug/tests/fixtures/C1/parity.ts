export function isEven(n: number): boolean {
  return n % 2 === 1; // bug: should be === 0
}
