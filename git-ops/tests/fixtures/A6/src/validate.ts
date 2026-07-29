export interface Recipient {
  email: string;
  locale: string;
}

export function isValidRecipient(r: Recipient): boolean {
  return r.email.includes("@") && r.locale.length > 0;
}
