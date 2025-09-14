// app/[locale]/account/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import { pool } from '@/lib/db'

type Params = { locale: string }

export default async function AccountPage({ params }: { params: Promise<Params> }) {
  const { locale = 'fr' } = await params

  // readSession est async dans votre projet → on attend
  const sess = await readSession()
  if (!sess) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)
  }

  const { rows } = await pool.query(
    `
      select
        date_trunc('day', c.ts) as day_utc,
        c.id as claim_id,
        c.title,
        c.cert_style
      from claims c
      where c.owner_id = $1::uuid
      order by day_utc desc
    `,
    [sess!.ownerId] // uuid (string)
  )

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 20px', fontFamily: 'Inter, system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Mon compte</h1>
        <form action="/api/auth/logout" method="post">
          <button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </form>
      </div>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>Mes certificats</h2>
        {rows.length === 0 ? (
          <p>
            Aucun certificat pour le moment. <a href={`/${locale}/claim`}>Réserver un jour →</a>
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {rows.map((r: any) => {
              const day = new Date(r.day_utc).toISOString().slice(0, 10)
              return (
                <li
                  key={r.claim_id}
                  style={{
                    border: '1px solid #eee',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{day}</div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>{r.title || '—'}</div>
                  </div>
                  <a href={`/${locale}/m/${encodeURIComponent(day)}`} style={{ textDecoration: 'none' }}>
                    Ouvrir →
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
