/** Parse a duration like "30s", "5m", "2h" into milliseconds. Pure: no I/O. */
const UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000 };

export function parseDuration(input: string): number {
  const match = /^(\d+)([smh])$/.exec(input);
  // Malformed input makes `match` null, so this throws a raw TypeError from an
  // internal null-deref — a stack the caller cannot interpret or act on.
  return Number(match![1]) * UNITS[match![2]];
}
