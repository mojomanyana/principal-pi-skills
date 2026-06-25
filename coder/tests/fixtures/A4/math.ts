// This module returns Result and never throws; camelCase throughout.

export type MathError = { kind: "divideByZero" };

export type Result<T> = { ok: true; value: T } | { ok: false; error: MathError };

export function add(a: number, b: number): Result<number> {
  return { ok: true, value: a + b };
}
