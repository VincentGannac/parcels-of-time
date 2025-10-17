export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { setSessionCookieOnResponse } from '@/lib/auth';

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
  let wantsAutopub = url.searchParams.get('autopub') === '1';
  if (!session_id) return NextResponse.redirect(`${base}/`, { status: 302 });

  let tsForRedirect = '';
  let outOwnerId = ''
  let outEmail = ''
  let outDisplayName: string | null = null

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

    // --------- Métadonnées Stripe minimales ---------
    const tsRaw = String(s.metadata?.ts || '');
    if (!tsRaw || isNaN(Date.parse(tsRaw))) {
      console.error('[confirm] missing_or_bad_ts', { tsRaw });
      return NextResponse.redirect(`${base}/`, { status: 302 });
    }
    const tsISOd = new Date(tsRaw); tsISOd.setUTCHours(0,0,0,0);
    const ts = tsISOd.toISOString();
    tsForRedirect = ts;

    const email = String(s.customer_details?.email || s.metadata?.email || '').trim().toLowerCase();
    const custom_bg_key = String(s.metadata?.custom_bg_key || '');
    const payloadKey = String(s.metadata?.payload_key || '').trim();

    // Valeurs par défaut (fallback rétro-compat)
    let display_name: string | null = (s.metadata?.display_name || '') || null;
    let title: string | null        = (s.metadata?.title || '') || null;
    let message: string | null      = (s.metadata?.message || '') || null;
    let link_url: string | null     = (s.metadata?.link_url || '') || null;

    let cert_style = safeStyle(s.metadata?.cert_style);
    let time_display: 'utc'|'utc+local'|'local+utc' = ((): any => {
      const td = String(s.metadata?.time_display || 'local+utc')
      return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc'
    })();
    let local_date_only = safeBool(s.metadata?.local_date_only);
    let text_color = safeHex(s.metadata?.text_color);
    let title_public = safeBool(s.metadata?.title_public);
    let message_public = safeBool(s.metadata?.message_public);
    let public_registry = safeBool(s.metadata?.public_registry);
    wantsAutopub = wantsAutopub || public_registry;

    // ⛳️ recharge JSON complet si payload_key
    if (payloadKey) {
      const { rows: p } = await pool.query(
        `select data from checkout_payload_temp where key = $1`,
        [payloadKey]
      );
      if (p.length) {
        const d = p[0].data || {};
        display_name    = (d.display_name ?? display_name) || null;
        title           = (d.title ?? title) || null;
        message         = (d.message ?? message) || null;
        link_url        = (d.link_url ?? link_url) || null;
        cert_style      = safeStyle(d.cert_style ?? cert_style);
        time_display    = ((): any => {
          const td = String(d.time_display ?? time_display);
          return (td==='utc'||td==='utc+local'||td==='local+utc') ? td : 'local+utc';
        })();
        local_date_only = (d.local_date_only !== undefined) ? safeBool(d.local_date_only) : local_date_only;
        text_color      = safeHex(d.text_color ?? text_color);
        title_public    = (d.title_public    !== undefined) ? safeBool(d.title_public)    : title_public;
        message_public  = (d.message_public  !== undefined) ? safeBool(d.message_public)  : message_public;
        public_registry = (d.public_registry !== undefined) ? safeBool(d.public_registry) : public_registry;
        wantsAutopub    = wantsAutopub || public_registry;
        await pool.query(`delete from checkout_payload_temp where key = $1`, [payloadKey]);
      }
    }

    const amount_total_raw =
      s.amount_total ??
      (typeof s.payment_intent !== 'string' && s.payment_intent
        ? (s.payment_intent.amount_received ?? s.payment_intent.amount ?? 0)
        : 0);
    const price_cents = Math.max(0, Number(amount_total_raw) | 0);
    const currency = String(s.currency || 'EUR').toUpperCase()

    // ====== Transaction DB ======
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // owners
      const { rows: ownerRows } = await client.query(
          `insert into owners(email)
          values ($1)
          on conflict (email) do update set email = excluded.email
          returning id`,
          [email]
      )
      const ownerId = ownerRows[0].id;
      outOwnerId = String(ownerId);
      outEmail = email;
      outDisplayName = display_name;

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

      pushOpt('display_name', display_name)
      pushOpt('title',        title)
      pushOpt('message',      message);
      pushOpt('link_url',     link_url);
      pushOpt('cert_style',   cert_style);
      pushOpt('time_display', time_display);
      pushOpt('local_date_only', local_date_only);
      pushOpt('text_color',   text_color);
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

      // hash + cert_url (toujours .pdf)
      const createdAtISO =
        claim.created_at instanceof Date ? claim.created_at.toISOString()
        : new Date(claim.created_at).toISOString();

      const salt = process.env.SECRET_SALT || 'dev_salt';
      const data = `${ts}|${ownerId}|${price_cents}|${createdAtISO}|${salt}`;

      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const ymd = ts.slice(0,10)
      const cert_url = `/api/cert/${encodeURIComponent(ymd)}.pdf`

      const cols2 = await getColumns(client, 'claims');
      if (cols2.has('cert_hash') || cols2.has('cert_url')) {
        await client.query(
          `update claims
             set ${cols2.has('cert_hash') ? 'cert_hash = $1' : 'cert_hash = cert_hash'},
                 ${cols2.has('cert_url')  ? 'cert_url  = $2' : 'cert_url  = cert_url'}
           where id = $3`,
          [hash, cert_url, claim.id]
        );
      }

      // Publication si demandé
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
      try {
        const ymd = ts.slice(0, 10)
        const publicUrl = `${base}/${locale}/m/${encodeURIComponent(ymd)}`
        const pdfUrl    = `${base}/api/cert/${encodeURIComponent(ymd)}.pdf`

        const { rows } = await pool.query(
          `select username from owners where email=$1 limit 1`, [email]
        )
        const accountName = rows[0]?.username || null

        const { createTransferTokenForClaim } = await import('@/lib/gift/transfer')
        const { rows: idRow } = await pool.query(
          `select id, cert_hash from claims where ts=$1::timestamptz limit 1`,
          [ts]
        )
        const claimId: string = String(idRow[0].id)
        const certHash: string = String(idRow[0].cert_hash)
        const { code } = await createTransferTokenForClaim(claimId)

        const recoverUrl = `${base}/${locale}/gift/recover?claim_id=${encodeURIComponent(claimId)}&cert_hash=${encodeURIComponent(certHash)}`
        const instructionsPdfUrl = `${base}/api/claim/${encodeURIComponent(claimId)}/transfer-guide.pdf?code=${encodeURIComponent(code)}&locale=${locale}`

        const { sendClaimReceiptEmail } = await import('@/lib/email')
        await sendClaimReceiptEmail({
          to: email,
          ts,
          displayName: accountName,
          publicUrl,
          certUrl: pdfUrl,
          transfer: {
            claimId,
            hash: certHash,
            code,
            recoverUrl,
            instructionsPdfUrl,
            locale: locale as 'fr' | 'en'
          }
        })
      } catch (e) {
        console.warn('[confirm] email warn:', (e as any)?.message || e)
      }

      // 🔸 Warm-up best-effort du PDF (non bloquant)
      try {
        const ymd = ts.slice(0,10)
        fetch(`${base}/api/cert/${encodeURIComponent(ymd)}.pdf?warmup=1`, { cache: 'no-store' })
          .catch(()=>{})
      } catch {}

    } catch (e:any) {
      try { await pool.query('ROLLBACK') } catch {}
      console.error('[confirm] db_error:', e?.message || e);
      // On laisse le webhook Stripe compléter si besoin
    }

    // Redirection finale (toujours YMD)
    {
      const ymd = (tsForRedirect || '').slice(0,10)
      const to = new URL(`${base}/${locale}/m/${encodeURIComponent(ymd)}?buy=success`);
      if (wantsAutopub) to.searchParams.set('autopub', '1');
      const res = NextResponse.redirect(to.toString(), { status: 303 });
      if (outOwnerId && outEmail) {
        setSessionCookieOnResponse(res, {
          ownerId: outOwnerId,
          email: outEmail,
          displayName: outDisplayName,
          iat: Math.floor(Date.now() / 1000),
        });
      }
      return res;
    }

  } catch (e:any) {
    console.error('confirm_error_top:', e?.message, e?.stack);
    return NextResponse.redirect(`${base}/`, { status: 302 });
  }
}
