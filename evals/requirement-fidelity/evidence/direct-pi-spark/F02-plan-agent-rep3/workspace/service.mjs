// Deliberately minimal existing behavior, not an implementation of SPEC.md.
export function normalizeLevel(value, unit) {
  if (unit === 'mm' && Number.isInteger(value)) return value;
  if (unit === 'cm' && Number.isInteger(value * 10)) return value * 10;
  throw new TypeError('invalid level');
}
