import { type CartLine, cartTotalCents } from "./cart";

export type PaymentResult =
  | { ok: true; capturedCents: number }
  | { ok: false; reason: "declined" | "gateway_unavailable" };

/** Charge a cart through the payments gateway. */
export async function chargeCart(
  lines: CartLine[],
  token: string,
  gateway: { charge(cents: number, token: string): Promise<{ status: number }> }
): Promise<PaymentResult> {
  const cents = cartTotalCents(lines);
  const res = await gateway.charge(cents, token);
  if (res.status === 200) return { ok: true, capturedCents: cents };
  if (res.status === 402) return { ok: false, reason: "declined" };
  return { ok: false, reason: "gateway_unavailable" };
}
