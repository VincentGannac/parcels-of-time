// lib/url.ts
import { headers } from 'next/headers';

export async function absoluteUrl(path: string) {
  const h = await headers(); // 👈 important
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') ? 'http' : 'https');
  return new URL(path, `${proto}://${host}`).toString();
}
