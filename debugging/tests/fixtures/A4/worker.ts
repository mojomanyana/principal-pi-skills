export const results: number[] = [];

// Runs the workers concurrently. Each task reads the current length, yields, then
// writes to that (now stale) index — so concurrent tasks clobber each other and
// updates are lost. Fails intermittently with a short count.
export async function runAll(items: number[]): Promise<number[]> {
  await Promise.all(
    items.map(async (x) => {
      const index = results.length; // read
      await Promise.resolve(); // yield — other tasks interleave here
      results[index] = x * 2; // write to a stale index
    }),
  );
  return results;
}
