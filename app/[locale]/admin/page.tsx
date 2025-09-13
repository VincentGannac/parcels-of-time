//app/locale/admin/page.tsx
import { pool } from '@/lib/db'

export const runtime = 'nodejs'
export const revalidate = 0

export default async function Page() {
  const { rows } = await pool.query(`
    SELECT c.ts, c.price_cents, c.currency, c.created_at,
           o.email, o.display_name
    FROM claims c JOIN owners o ON o.id=c.owner_id
    ORDER BY c.created_at DESC
    LIMIT 200
  `)

  return (
    <main style={{fontFamily:'Inter, system-ui', padding:24}}>
      <h1>Admin — Last claims</h1>
      <a href="/api/admin/export" style={{display:'inline-block', margin:'12px 0'}}>Export CSV</a>
      <table cellPadding={8} style={{borderCollapse:'collapse', width:'100%'}}>
        <thead>
          <tr>
            <th align="left">TS</th><th align="left">Email</th><th align="left">Name</th>
            <th align="right">Price</th><th align="left">Currency</th><th align="left">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r:any) => (
            <tr key={`${r.ts}-${r.email}`}>
              <td>{new Date(r.ts).toISOString()}</td>
              <td>{r.email}</td>
              <td>{r.display_name || '—'}</td>
              <td align="right">{(r.price_cents||0)/100}</td>
              <td>{r.currency}</td>
              <td>{new Date(r.created_at).toISOString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
