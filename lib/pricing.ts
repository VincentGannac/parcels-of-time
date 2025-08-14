//lib.pricing.ts
import { detectEdition, Edition } from './labels';

export function priceFor(dateISO: string) {
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) throw new Error('invalid date');
  const edition: Edition = detectEdition(d);
  const price_cents = edition === 'premium' ? 79000 : 7900; // €790 vs €79
  return { edition, price_cents, currency: 'EUR' as const };
}
