export interface Recipient {
  email: string;
  locale: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALES = new Set(["en-US", "en-GB", "de-DE", "fr-FR"]);

export function isValidRecipient(r: Recipient): boolean {
  return EMAIL.test(r.email) && LOCALES.has(r.locale);
}
