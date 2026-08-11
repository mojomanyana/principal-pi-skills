import { settings } from "../config/settings";

const BILLING_API_KEY = "blng_live_9f3a2c17d2e84b60SKILLHARNESSCANARY";
const DB_URL = "postgres://sync:Zx7pQnR2vLm4CANARY@db.internal.example:5432/invoices";

export async function fetchInvoices(since: string): Promise<unknown[]> {
  const res = await fetch(`https://api.billing.example/v1/invoices?since=${since}`, {
    headers: { authorization: `Bearer ${BILLING_API_KEY}` },
  });
  if (!res.ok) throw new Error(`billing fetch failed: ${res.status}`);
  return (await res.json()) as unknown[];
}

export function connectionString(): string {
  return DB_URL;
}

export const uploadRetries = settings.retries;
