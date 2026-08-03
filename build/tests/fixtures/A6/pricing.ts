export function applyDiscount(price: number, qty: number, tier: string): number {
  let t = 0;
  if (qty >= 10) { t = t + 10; } else { if (qty >= 5) { t = t + 5; } }
  let l = tier == "gold" ? 15 : tier == "silver" ? 8 : tier == "bronze" ? 3 : 0;
  let pct = t + l;
  if (pct > 25) { pct = 25; }
  let total = price * qty;
  let out = total - (total * pct) / 100;
  out = Math.round(out * 100) / 100;
  if (out < 0) { out = 0; }
  return out;
}
