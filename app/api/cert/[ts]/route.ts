// api/cert/[ts]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { generateCertificatePDF } from '@/lib/cert';
import { Buffer } from 'node:buffer';

type Params = { ts: string };

export async function GET(req: Request, ctx: { params: Promise<{ ts: string }> }) {
  const { ts } = await ctx.params
  const decodedTs = decodeURIComponent(ts)

  const accLang = (req.headers.get('accept-language') || '').toLowerCase()
  const locale = accLang.startsWith('fr') ? 'fr' : 'en' // simple et efficace
  const timeModeParam = new URL(req.url).searchParams.get('time') // 'utc' | 'utc_plus_local' | 'local_plus_utc'
  const timeLabelMode = (timeModeParam === 'utc_plus_local' || timeModeParam === 'local_plus_utc') ? timeModeParam : 'utc'

  const { rows } = await pool.query(
    `SELECT
       c.id AS claim_id, c.ts, c.title, c.message, c.link_url, c.cert_hash, c.created_at, c.cert_style,
       o.display_name
     FROM claims c
     JOIN owners o ON o.id = c.owner_id
     WHERE c.ts = $1::timestamptz`,
    [decodedTs]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const row = rows[0];
  const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
  const publicUrl = `${base}/m/${encodeURIComponent(decodedTs)}`;
  const g = globalThis as any
  const customBgByTs: Map<string, string> = g.__customBgByTs || new Map<string,string>()
  const customBgDataUrl = customBgByTs.get(ts) || undefined


  const pdfBytes = await generateCertificatePDF({
    ts: row.ts.toISOString(),
    display_name: row.display_name || (locale === 'fr' ? 'Anonyme' : 'Anonymous'),
    title: row.title,
    message: row.message,
    link_url: row.link_url,
    claim_id: row.claim_id,
    hash: row.cert_hash || 'no-hash',
    public_url: publicUrl,
    style: row.cert_style || 'neutral',
    customBgDataUrl, // ⬅️ passe l’image au générateur (si présente)
    locale,               // ⬅️ localise les libellés
    timeLabelMode,        // ⬅️ affiche UTC / Local selon préférence
  })

  const buf = Buffer.from(pdfBytes);
  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cert-${encodeURIComponent(decodedTs)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
