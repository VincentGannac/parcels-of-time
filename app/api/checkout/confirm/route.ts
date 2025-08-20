// app/api/checkout/confirm/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import crypto from 'crypto';
import { pool } from '@/lib/db';

type CertStyle = 'neutral'|'romantic'|'birthday'|'wedding'|'birth'|'christmas'|'newyear'|'graduation'|'custom'
const ALLOWED_STYLES: readonly CertStyle[] = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'] as const

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

  try {
    const url = new URL(req.url);
    const session_id = url.searchParams.get('session_id');
    if (!session_id) return NextResponse.redirect(`${base}/`, { status: 302 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const s = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] });

    if (s.payment_status !== 'paid') {
      const backTs = String(s.metadata?.ts || '');
      return NextResponse.redirect(`${base}/claim?ts=${encodeURIComponent(backTs)}&status=unpaid`, { status: 302 });
    }

    const ts = String(s.metadata?.ts || '');
    const email = String(s.customer_details?.email || s.metadata?.email || '');
    const display_name = (s.metadata?.display_name || '') || null;
    const title = (s.metadata?.title || '') || null;
    const message = (s.metadata?.message || '') || null;
    const link_url = (s.metadata?.link_url || '') || null;

    const styleCandidate = String(s.metadata?.cert_style || 'neutral').toLowerCase();
    const cert_style: CertStyle = (ALLOWED_STYLES as readonly string[]).includes(styleCandidate) ? (styleCandidate as CertStyle) : 'neutral';

    const custom_bg_key = String(s.metadata?.custom_bg_key || '');

    const time_display = (s.metadata?.time_display === 'utc' || s.metadata?.time_display === 'utc+local' || s.metadata?.time_display === 'local+utc')
      ? s.metadata?.time_display : 'local+utc'
    const local_date_only = String(s.metadata?.local_date_only) === '1'
    const text_color = /^#[0-9a-fA-F]{6}$/.test(String(s.metadata?.text_color || '')) ? String(s.metadata?.text_color).toLowerCase() : '#1a1f2a'

    const amount_total =
      s.amount_total ??
      (typeof s.payment_intent !== 'string' && s.payment_intent
        ? (s.payment_intent.amount_received ?? s.payment_intent.amount ?? 0)
        : 0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: ownerRows } = await client.query(
        `INSERT INTO owners(email, display_name)
         VALUES($1,$2)
         ON CONFLICT(email) DO UPDATE
           SET display_name = COALESCE(EXCLUDED.display_name, owners.display_name)
         RETURNING id`,
        [email.toLowerCase(), display_name]
      );
      const ownerId = ownerRows[0].id;

      const { rows: claimRows } = await client.query(
        `INSERT INTO claims (ts, owner_id, price_cents, currency, title, message, link_url, cert_style, time_display, local_date_only, text_color)
         VALUES ($1::timestamptz, $2, $3, 'EUR', $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (ts) DO UPDATE
           SET message         = EXCLUDED.message,
               title           = EXCLUDED.title,
               link_url        = EXCLUDED.link_url,
               cert_style      = EXCLUDED.cert_style,
               time_display    = EXCLUDED.time_display,
               local_date_only = EXCLUDED.local_date_only,
               text_color      = EXCLUDED.text_color
         RETURNING id, created_at`,
        [ts, ownerId, amount_total, title, message, link_url, cert_style, time_display, local_date_only, text_color]
      );
      const claim = claimRows[0];

      // custom bg persistance
      if (cert_style === 'custom' && custom_bg_key) {
        const { rows: tmp } = await client.query('SELECT data_url FROM custom_bg_temp WHERE key = $1', [custom_bg_key]);
        if (tmp.length) {
          await client.query(
            `INSERT INTO claim_custom_bg (ts, data_url)
             VALUES ($1::timestamptz, $2)
             ON CONFLICT (ts) DO UPDATE
               SET data_url = EXCLUDED.data_url, created_at = now()`,
            [ts, tmp[0].data_url]
          );
          await client.query('DELETE FROM custom_bg_temp WHERE key = $1', [custom_bg_key]);
        }
      }

      const createdAtISO = claim.created_at instanceof Date ? claim.created_at.toISOString() : new Date(claim.created_at).toISOString();
      const salt = process.env.SECRET_SALT || 'dev_salt';
      const data = `${ts}|${ownerId}|${amount_total}|${createdAtISO}|${salt}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const cert_url = `/api/cert/${encodeURIComponent(ts)}`;

      await client.query('UPDATE claims SET cert_hash=$1, cert_url=$2 WHERE id=$3', [hash, cert_url, claim.id]);
      await client.query('COMMIT');

      // email
      try {
        const publicUrl = `${base}/m/${encodeURIComponent(ts)}`;
        const certUrl = `${base}/api/cert/${encodeURIComponent(ts)}`;
        const { sendClaimReceiptEmail } = await import('@/lib/email');
        await sendClaimReceiptEmail({ to: email, ts, displayName: display_name, publicUrl, certUrl })
      } catch (e) {
        console.warn('send_email_warning:', (e as any)?.message || e);
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }

    return NextResponse.redirect(`${base}/m/${encodeURIComponent(ts)}`, { status: 303 });
  } catch (e:any) {
    console.error('confirm_error:', e?.message, e?.stack);
    return new Response('Payment captured, but we hit a server error finalizing your certificate (minute).', { status: 500 });
  }
}
