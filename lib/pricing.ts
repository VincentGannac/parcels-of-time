import { detectEdition, Edition } from './labels';

export function priceFor(dateISO: string) {
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) throw new Error('invalid date');
  d.setUTCSeconds(0,0); // ⬅️ minute
  const edition: Edition = detectEdition(d);
  const price_cents = edition === 'premium' ? 7900 : 7900; // ajuste si tu veux monétiser + la rareté minute
  return { edition, price_cents, currency: 'EUR' as const };
}
