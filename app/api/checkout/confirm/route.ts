// app/api/checkout/confirm/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import crypto from 'node:crypto';
import { pool } from '@/lib/db';

type CertStyle =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation' | 'custom';

const ALLOWED_STYLES: readonly CertStyle[] = [
  'neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation','custom'
] as const;

// Utils introspection schéma
async function tableExists(client: any, table: string) {
  const { rows } = await client.query(
    `select to_regclass($1) as exists`,
    [`public.${table}`]
  );
  return !!rows[0]?.exists;
}
async function getColumns(client: any, table: string) {
  const { rows } = await client.query(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name=$1`,
    [table]
  );
  return new Set<string>(rows.map((r: any) => r.column_name));
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;
  const accLang = (req.headers.get('accept-language') || '').toLowerCase();
  const locale = accLang.startsWith('fr') ? 'fr' : 'en';

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

    // --------- Métadonnées Stripe ---------
    const ts = String(s.metadata?.ts || '');
    const email = String(s.customer_details?.email || s.metadata?.email || '');
    const display_name = (s.metadata?.display_name || '') || null;
    const title = (s.metadata?.title || '') || null;
    const message = (s.metadata?.message || '') || null;
    const link_url = (s.metadata?.link_url || '') || null;

    const styleCandidate = String(s.metadata?.cert_style || 'neutral').toLowerCase();
    const cert_style: CertStyle = (ALLOWED_STYLES as readonly string[]).includes(styleCandidate)
      ? (styleCandidate as CertStyle)
      : 'neutral';

    const custom_bg_key = String(s.metadata?.custom_bg_key || '');

    const time_display = (s.metadata?.time_display === 'utc' || s.metadata?.time_display === 'utc+local' || s.metadata?.time_display === 'local+utc')
      ? s.metadata?.time_display : 'local+utc';
    const local_date_only = String(s.metadata?.local_date_only) === '1';
    const text_color = /^#[0-9a-fA-F]{6}$/.test(String(s.metadata?.text_color || ''))
      ? String(s.metadata?.text_color).toLowerCase() : '#1a1f2a';

    const title_public = String(s.metadata?.title_public) === '1';
    const message_public = String(s.metadata?.message_public) === '1';

    const amount_total =
      s.amount_total ??
      (typeof s.payment_intent !== 'string' && s.payment_intent
        ? (s.payment_intent.amount_received ?? s.payment_intent.amount ?? 0)
        : 0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // --- owners
      const { rows: ownerRows } = await client.query(
        `insert into owners(email, display_name)
         values($1,$2)
         on conflict(email) do update
           set display_name = coalesce(excluded.display_name, owners.display_name)
         returning id`,
        [email.toLowerCase(), display_name]
      );
      const ownerId = ownerRows[0].id;

      // --- claims : introspection schéma + INSERT dynamique
      const cols = await getColumns(client, 'claims');

      // Colonnes minimales supposées
      const baseCols: Array<[name: string, value: any]> = [
        ['ts', ts],
        ['owner_id', ownerId],
        ['price_cents', amount_total],
        ['currency', 'EUR'],
      ];

      // Colonnes optionnelles (selon schéma)
      const optional: Array<[string, any]> = [
        ['title', title],
        ['message', message],
        ['link_url', link_url],
        ['cert_style', cert_style],
        ['time_display', time_display],
        ['local_date_only', local_date_only],
        ['text_color', text_color],
        ['title_public', title_public],
        ['message_public', message_public],
      ];

      const insertCols: string[] = [];
      const values: any[] = [];
      const placeholders: string[] = [];

      for (const [name, value] of baseCols) {
        insertCols.push(name);
        values.push(value);
        placeholders.push(`$${values.length}`);
      }
      for (const [name, value] of optional) {
        if (cols.has(name)) {
          insertCols.push(name);
          values.push(value);
          placeholders.push(`$${values.length}`);
        }
      }

      const updateCols = insertCols.filter(n => !['ts','owner_id','price_cents','currency'].includes(n));
      const updateSet = updateCols.length
        ? updateCols.map(n => `${n} = excluded.${n}`).join(', ')
        : 'ts = excluded.ts'; // no-op pour satisfaire la syntaxe

      const insertSql = `
        insert into claims (${insertCols.join(', ')})
        values (${placeholders.join(', ')})
        on conflict (ts) do update set ${updateSet}
        returning id, created_at
      `;
      const { rows: claimRows } = await client.query(insertSql, values);
      const claim = claimRows[0];

      // --- custom background : optionnel & robuste
      if (cert_style === 'custom' && custom_bg_key) {
        const hasTemp = await tableExists(client, 'custom_bg_temp');
        const hasPersist = await tableExists(client, 'claim_custom_bg');
        if (hasTemp && hasPersist) {
          const { rows: tmp } = await client.query('select data_url from custom_bg_temp where key = $1', [custom_bg_key]);
          if (tmp.length) {
            await client.query(
              `insert into claim_custom_bg (ts, data_url)
               values ($1::timestamptz, $2)
               on conflict (ts) do update
                 set data_url = excluded.data_url, created_at = now()`,
              [ts, tmp[0].data_url]
            );
            await client.query('delete from custom_bg_temp where key = $1', [custom_bg_key]);
          }
        }
      }

      // --- hash/cert_url (si colonnes présentes ; sinon on ignore)
      const createdAtISO =
        claim.created_at instanceof Date ? claim.created_at.toISOString() : new Date(claim.created_at).toISOString();

      const salt = process.env.SECRET_SALT || 'dev_salt';
      const data = `${ts}|${ownerId}|${amount_total}|${createdAtISO}|${salt}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const cert_url = `/api/cert/${encodeURIComponent(ts)}`;

      try {
        if (cols.has('cert_hash') || cols.has('cert_url')) {
          await client.query(
            `update claims
               set ${cols.has('cert_hash') ? 'cert_hash = $1' : 'cert_hash = cert_hash'},
                   ${cols.has('cert_url')  ? 'cert_url  = $2' : 'cert_url  = cert_url'}
             where id = $3`,
            [hash, cert_url, claim.id]
          );
        }
      } catch (e) {
        // Non bloquant : la claim est créée, mais pas d’empreinte / url persistées
        console.warn('confirm_hash_update_warning:', (e as any)?.message || e);
      }

      await client.query('COMMIT');

      // --- email (non bloquant)
      try {
        const publicUrl = `${base}/${locale}/m/${encodeURIComponent(ts)}`;
        const certUrl = `${base}/api/cert/${encodeURIComponent(ts)}`;
        const { sendClaimReceiptEmail } = await import('@/lib/email');
        await sendClaimReceiptEmail({ to: email, ts, displayName: display_name, publicUrl, certUrl });
      } catch (e) {
        console.warn('send_email_warning:', (e as any)?.message || e);
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.redirect(`${base}/${locale}/m/${encodeURIComponent(ts)}`, { status: 303 });
  } catch (e: any) {
    console.error('confirm_error:', e?.message, e?.stack);
    return new Response(
      'Payment captured, but we hit a server error finalizing your certificate (minute).',
      { status: 500 }
    );
  }
}
