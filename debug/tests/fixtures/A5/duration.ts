/** Parse a duration like "30s", "5m", "2h" into milliseconds. Pure: no I/O. */
const UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000 };

export function parseDuration(input: string): number {
  const match = /^(\d+)([smh])$/.exec(input);
  if (!match) {
    throw new RangeError(`Invalid duration: "${input}". Expected format like "30s", "5m", or "2h".`);
  }
  return Number(match[1]) * UNITS[match[2]];
}
