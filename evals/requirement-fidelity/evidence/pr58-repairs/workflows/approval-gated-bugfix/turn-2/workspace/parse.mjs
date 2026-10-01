export function parseCount(value) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw new TypeError('invalid count');
  }

  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    throw new TypeError('invalid count');
  }

  return count;
}
