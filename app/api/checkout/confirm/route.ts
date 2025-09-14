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

async function tableExists(client: any, table: string) {
  const { rows } = await client.query(`select to_regclass($1) as exists`, [`public.${table}`]);
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

function safeBool(v: unknown) { return String(v) === '1' || v === true }
function safeHex(v: unknown, fallback='#1a1f2a') {
  return /^#[0-9a-fA-F]{6}$/.test(String(v||'')) ? String(v).toLowerCase() : fallback
}
function safeStyle(v: unknown): CertStyle {
  const s = String(v||'neutral').toLowerCase()
  return (ALLOWED_STYLES as readonly string[]).includes(s as CertStyle) ? (s as CertStyle) : 'neutral'
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;
  const accLang = (req.headers.get('accept-language') || '').toLowerCase();
  const locale = accLang.startsWith('fr') ? 'fr' : 'en';

  const url = new URL(req.url);
  const session_id = url.searchParams.get('session_id');
    // ✅ récupère l’intention d’auto-publication passée par /api/checkout
  let wantsAutopub = url.searchParams.get('autopub') === '1';
  // Si pas de session_id → retour accueil
  if (!session_id) return NextResponse.redirect(`${base}/`, { status: 302 });

  let tsForRedirect = ''; // on essaie de toujours rediriger même en cas d’erreur DB

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const s = await stripe.checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] });

    if (s.payment_status !== 'paid') {
      const backTs = String(s.metadata?.ts || '');
      const safeBack = backTs && !isNaN(Date.parse(backTs))
        ? encodeURIComponent(new Date(backTs).toISOString())
        : '';
      return NextResponse.redirect(`${base}/claim?ts=${safeBack}&status=unpaid`, { status: 302 });
    }

    // --------- Métadonnées Stripe ---------
    const tsRaw = String(s.metadata?.ts || '');
    if (!tsRaw || isNaN(Date.parse(tsRaw))) {
      console.error('[confirm] missing_or_bad_ts', { tsRaw });
      // si introuvable → on sort proprement
      return NextResponse.redirect(`${base}/`, { status: 302 });
    }
    const tsISO = new Date(tsRaw); tsISO.setUTCHours(0,0,0,0);
    const ts = tsISO.toISOString();
    tsForRedirect = ts; // pour la redirection finale

    const email = String(s.customer_details?.email || s.metadata?.email || '').trim().toLowerCase();
    const display_name = (s.metadata?.display_name || '') || null;
    const title = (s.metadata?.title || '') || null;
    const message = (s.metadata?.message || '') || null;
    const link_url = (s.metadata?.link_url || '') || null;

    const cert_style = safeStyle(s.metadata?.cert_style);
    const custom_bg_key = String(s.metadata?.custom_bg_key || '');

    const td = String(s.metadata?.time_display || 'local+utc');
    const time_display = (td === 'utc' || td === 'utc+local' || td === 'local+utc') ? td : 'local+utc';
    const local_date_only = safeBool(s.metadata?.local_date_only);
    const text_color = safeHex(s.metadata?.text_color);

    const title_public = safeBool(s.metadata?.title_public);
    const message_public = safeBool(s.metadata?.message_public);
    const public_registry = safeBool(s.metadata?.public_registry);
        // ✅ renforce wantsAutopub avec la méta Stripe (filet de sécurité)
    wantsAutopub = wantsAutopub || public_registry;

    const amount_total_raw =
      s.amount_total ??
      (typeof s.payment_intent !== 'string' && s.payment_intent
        ? (s.payment_intent.amount_received ?? s.payment_intent.amount ?? 0)
        : 0);
    const price_cents = Math.max(0, Number(amount_total_raw) | 0);
    const currency = String(s.currency || 'EUR').toUpperCase()

    // ====== Transaction DB (robuste) ======
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // owners
      const { rows: ownerRows } = await client.query(
        `insert into owners(email, display_name)
         values($1,$2)
         on conflict(email) do update
           set display_name = coalesce(excluded.display_name, owners.display_name)
         returning id`,
        [email, display_name]
      );
      const ownerId = ownerRows[0].id;

      // claims upsert dynamique
      const cols = await getColumns(client, 'claims');
      const insertCols: string[] = ['ts','owner_id','price_cents','currency']
      const values: any[] = [ts, ownerId, price_cents, currency]
      const placeholders: string[] = ['$1','$2','$3','$4'];

      const pushOpt = (name: string, value: any) => {
        if (cols.has(name)) {
          insertCols.push(name);
          values.push(value);
          placeholders.push(`$${values.length}`);
        }
      };

      pushOpt('title', title);
      pushOpt('message', message);
      pushOpt('link_url', link_url);
      pushOpt('cert_style', cert_style);
      pushOpt('time_display', time_display);
      pushOpt('local_date_only', local_date_only);
      pushOpt('text_color', text_color);
      pushOpt('title_public', title_public);
      pushOpt('message_public', message_public);
      

      const updateCols = insertCols.filter(n => !['ts','owner_id','price_cents','currency'].includes(n));
      const updateSet = updateCols.length
        ? updateCols.map(n => `${n} = excluded.${n}`).join(', ')
        : 'ts = excluded.ts';

      const sql = `
        insert into claims (${insertCols.join(', ')})
        values (${placeholders.join(', ')})
        on conflict (ts) do update set ${updateSet}
        returning id, created_at
      `;
      const { rows: claimRows } = await client.query(sql, values);
      const claim = claimRows[0];

      // custom background temp -> persist
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

      // hash + cert_url
      const createdAtISO =
        claim.created_at instanceof Date ? claim.created_at.toISOString()
        : new Date(claim.created_at).toISOString();

      const salt = process.env.SECRET_SALT || 'dev_salt';
      const data = `${ts}|${ownerId}|${price_cents}|${createdAtISO}|${salt}`;

      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const cert_url = `/api/cert/${encodeURIComponent(ts)}`;

      if (cols.has('cert_hash') || cols.has('cert_url')) {
        await client.query(
          `update claims
             set ${cols.has('cert_hash') ? 'cert_hash = $1' : 'cert_hash = cert_hash'},
                 ${cols.has('cert_url')  ? 'cert_url  = $2' : 'cert_url  = cert_url'}
           where id = $3`,
          [hash, cert_url, claim.id]
        );
      }

      // ✅ Publication dans la même transaction que la claim
      if (public_registry) {
        await client.query(
          `insert into minute_public (ts)
            values ($1::timestamptz)
            on conflict (ts) do nothing`,
          [ts]
        );
      }

      await client.query('COMMIT');

      // email après commit (non bloquant)
      const publicUrl = `${base}/${locale}/m/${encodeURIComponent(ts)}`;
      const pdfUrl = `${base}/api/cert/${encodeURIComponent(ts)}`;
      import('@/lib/email')
        .then(({ sendClaimReceiptEmail }) =>
          sendClaimReceiptEmail({ to: email, ts, displayName: display_name, publicUrl, certUrl: pdfUrl })
        )
        .catch(e => console.warn('[confirm] email warn:', e?.message || e));

    } catch (e:any) {
      try { await pool.query('ROLLBACK') } catch {}
      console.error('[confirm] db_error:', e?.message || e);
      // ⚠️ On NE renvoie PAS 500 : on continue vers la page de la minute.
      // Le webhook Stripe /api/stripe/webhook complètera l’écriture côté DB si nécessaire.
    }

    // Toujours rediriger côté client (même si DB a échoué ici)
    {
      const to = new URL(`${base}/${locale}/m/${encodeURIComponent(tsForRedirect)}`);
      if (wantsAutopub) to.searchParams.set('autopub', '1');
      return NextResponse.redirect(to.toString(), { status: 303 });
    }

  } catch (e:any) {
    console.error('confirm_error_top:', e?.message, e?.stack);
    // En dernier recours : retour accueil sans 500
    return NextResponse.redirect(`${base}/`, { status: 302 });
  }
}
