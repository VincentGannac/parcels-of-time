// app/api/admin/export/route.ts
export const runtime = 'nodejs'
import { pool } from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT c.ts, o.email, o.display_name, c.price_cents, c.currency, c.created_at
    FROM claims c JOIN owners o ON o.id=c.owner_id
    ORDER BY c.created_at DESC
  `)
  const header = 'ts,email,display_name,price_cents,currency,created_at'
  const lines = rows.map((r:any) =>
    [new Date(r.ts).toISOString(), r.email, (r.display_name||'').replace(/,/g,' '),
     r.price_cents||0, r.currency, new Date(r.created_at).toISOString()].join(',')
  )
  const csv = [header, ...lines].join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':'attachment; filename="claims.csv"',
    },
  })
}
