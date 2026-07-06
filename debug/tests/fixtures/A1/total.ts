export function runningTotal(nums: number[]): number {
  let total = 0;
  for (const n of nums) {
    total = n; // bug: overwrites instead of accumulating
  }
  return total;
}
