// app/[locale]/account/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import { pool } from '@/lib/db'

type Params = { locale: 'fr' | 'en' }

type ClaimRow = {
  ts: string
  title: string | null
  message: string | null
  cert_style: string | null
}

async function listClaims(ownerId: string): Promise<ClaimRow[]> {
  try {
    const { rows } = await pool.query(
      `select to_char(date_trunc('day', ts) at time zone 'UTC', 'YYYY-MM-DD') as ts,
              title, message, cert_style
       from claims
       where owner_id = $1
       order by ts desc
       limit 200`,
      [ownerId]
    )
    return rows.map(r => ({
      ts: String(r.ts),
      title: r.title ?? null,
      message: r.message ?? null,
      cert_style: r.cert_style ?? null,
    }))
  } catch {
    return []
  }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const sess = await readSession()
  if (!sess) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)
  }

  const claims = await listClaims(sess.ownerId)

  return (
    <main style={{maxWidth: 900, margin: '0 auto', padding: '32px 20px', fontFamily: 'Inter, system-ui'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 18}}>
        <a href={`/${locale}`} style={{textDecoration:'none', opacity:.85}}>&larr; Parcels of Time</a>
        <form method="post" action="/api/auth/logout">
          <button style={{padding:'10px 14px', borderRadius:10, border:'1px solid #ddd', cursor:'pointer'}}>Log out</button>
        </form>
      </header>

      <h1 style={{fontFamily:'Fraunces, serif', fontSize:36, margin:'0 0 6px'}}>
        {locale === 'fr' ? 'Mon compte' : 'My account'}
      </h1>
      <p style={{opacity:.8, marginTop:0}}>
        {sess.displayName ? `${sess.displayName} — ` : ''}{sess.email}
      </p>

      <section style={{marginTop:18}}>
        <h2 style={{fontSize:18, margin:'0 0 10px'}}>{locale === 'fr' ? 'Mes certificats' : 'My certificates'}</h2>

        {claims.length === 0 ? (
          <div style={{border:'1px dashed #ddd', padding:16, borderRadius:12, opacity:.8}}>
            {locale === 'fr' ? 'Aucun certificat pour le moment.' : 'No certificates yet.'}
          </div>
        ) : (
          <div style={{display:'grid', gap:10}}>
            {claims.map(c => {
              const href = `/${locale}/m/${encodeURIComponent(c.ts)}`
              return (
                <a key={c.ts} href={href}
                   style={{display:'block', padding:14, border:'1px solid #eee', borderRadius:12, textDecoration:'none', color:'inherit'}}>
                  <div style={{fontWeight:700}}>{c.ts}</div>
                  {c.title && <div style={{opacity:.85, marginTop:4}}>{c.title}</div>}
                  {c.message && <div style={{opacity:.65, marginTop:2, whiteSpace:'pre-wrap'}}>{c.message}</div>}
                </a>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
