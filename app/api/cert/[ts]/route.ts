// app/api/cert/[ts]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { generateCertificatePDF } from '@/lib/cert';
import { Buffer } from 'node:buffer';

type Params = { ts: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { ts } = await ctx.params;
  const decodedTs = decodeURIComponent(ts);

  // 1) Récupère la claim
  const { rows } = await pool.query(
    `SELECT
       c.id AS claim_id, c.ts, c.message, c.link_url, c.cert_hash, c.created_at,
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
  const publicUrl =
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/s/${encodeURIComponent(decodedTs)}`;

  // 2) Génère le PDF (Uint8Array)
  const pdfBytes = await generateCertificatePDF({
    ts: row.ts.toISOString(),
    display_name: row.display_name || 'Anonymous',
    message: row.message,
    link_url: row.link_url,
    claim_id: row.claim_id,
    hash: row.cert_hash || 'no-hash',
    public_url: publicUrl,
  });

  // 3) ✅ Conversion Node : Buffer → BodyInit (typesafe sur Vercel)
  const buf = Buffer.from(pdfBytes);

  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cert-${encodeURIComponent(decodedTs)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
