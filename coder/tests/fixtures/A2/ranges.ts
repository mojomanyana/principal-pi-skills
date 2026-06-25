export function sliceRange<T>(xs: T[], start: number, end: number): T[] {
  return xs.slice(start, end); // bug: should include the end index
}

export function formatDate(d: { month: number; day: number; year: number }): string {
  return d.month + "/" + d.day + "/" + d.year; // (separately: no zero-padding)
}
