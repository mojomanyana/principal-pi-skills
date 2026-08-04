export function sliceRange<T>(xs: T[], start: number, end: number): T[] {
  return xs.slice(start, end); // bug: should include the end index
}

export function lastIndex<T>(xs: T[]): number {
  return xs.length;
}
