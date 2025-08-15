export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import crypto from 'crypto';
import { pool } from '@/lib/db';

type CertStyle =
  | 'neutral'
  | 'romantic'
  | 'birthday'
  | 'wedding'
  | 'birth'
  | 'christmas'
  | 'newyear'
  | 'graduation';

const ALLOWED_STYLES: readonly CertStyle[] = [
  'neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation'
] as const;

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

  try {
    const url = new URL(req.url);
    const session_id = url.searchParams.get('session_id');
    if (!session_id) {
      return NextResponse.redirect(`${base}/`, { status: 302 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const s = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] });

    if (s.payment_status !== 'paid') {
      const backTs = String(s.metadata?.ts || '');
      return NextResponse.redirect(`${base}/claim?ts=${encodeURIComponent(backTs)}&status=unpaid`, { status: 302 });
    }

    const ts = String(s.metadata?.ts || '');
    if (!ts) {
      console.error('[confirm] missing ts in session metadata', { session_id });
      return NextResponse.redirect(`${base}/claim?status=missing_ts`, { status: 302 });
    }

    const email = String(s.customer_details?.email || s.metadata?.email || '');
    const display_name = (s.metadata?.display_name || '') || null;
    const message = (s.metadata?.message || '') || null;
    const link_url = (s.metadata?.link_url || '') || null;

    // montant (fallback si amount_total absent)
    const amount_total =
      s.amount_total ??
      (typeof s.payment_intent !== 'string' && s.payment_intent
        ? (s.payment_intent.amount_received ?? s.payment_intent.amount ?? 0)
        : 0);

    // re-valider le style
    const styleCandidate = String(s.metadata?.cert_style || 'neutral').toLowerCase();
    const cert_style: CertStyle = (ALLOWED_STYLES as readonly string[]).includes(styleCandidate)
      ? (styleCandidate as CertStyle)
      : 'neutral';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // owner
      const { rows: ownerRows } = await client.query(
        `INSERT INTO owners(email, display_name)
         VALUES($1,$2)
         ON CONFLICT(email) DO UPDATE
           SET display_name = COALESCE(EXCLUDED.display_name, owners.display_name)
         RETURNING id`,
        [email.toLowerCase(), display_name]
      );
      const ownerId = ownerRows[0].id;

      // claim
      const { rows: claimRows } = await client.query(
        `INSERT INTO claims (ts, owner_id, price_cents, currency, message, link_url, cert_style)
         VALUES ($1::timestamptz, $2, $3, 'EUR', $4, $5, $6)
         ON CONFLICT (ts) DO UPDATE
           SET message    = EXCLUDED.message,
               link_url   = EXCLUDED.link_url,
               cert_style = EXCLUDED.cert_style
         RETURNING id, created_at`,
        [ts, ownerId, amount_total, message, link_url, cert_style]
      );
      const claim = claimRows[0];

      // ⚠️ created_at peut être une string → normaliser en ISO
      const createdAtISO =
        claim.created_at instanceof Date
          ? claim.created_at.toISOString()
          : new Date(claim.created_at).toISOString();

      // hash + cert_url
      const salt = process.env.SECRET_SALT || 'dev_salt';
      const data = `${ts}|${ownerId}|${amount_total}|${createdAtISO}|${salt}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const cert_url = `/api/cert/${encodeURIComponent(ts)}`;

      await client.query(
        'UPDATE claims SET cert_hash=$1, cert_url=$2 WHERE id=$3',
        [hash, cert_url, claim.id]
      );

      await client.query('COMMIT');

      // email post-commit (best effort)
      try {
        const publicUrl = `${base}/s/${encodeURIComponent(ts)}`;
        const certUrl = `${base}/api/cert/${encodeURIComponent(ts)}`;
        const { sendClaimReceiptEmail } = await import('@/lib/email');
        await sendClaimReceiptEmail({ to: email, ts, displayName: display_name, publicUrl, certUrl });
      } catch (e) {
        console.warn('[confirm] email send failed (ignored)', (e as Error)?.message);
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[confirm] transaction error', e);
      throw e;
    } finally {
      client.release();
    }

    // ✅ redirection finale vers la page publique
    return NextResponse.redirect(`${base}/s/${encodeURIComponent(ts)}`, { status: 303 });
  } catch (err) {
    console.error('[confirm] fatal error', err);
    // Éviter la page blanche : message minimal + consigne
    return new Response(
      'Payment captured, but we hit a server error finalizing your certificate. Your payment is safe. Please contact support@parcelsoftime.com with your email and timestamp.',
      { status: 500 }
    );
  }
}
