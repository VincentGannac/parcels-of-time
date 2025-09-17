// app/[locale]/account/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import { pool } from '@/lib/db'

type Params = { locale: string }

export default async function Page({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const session = await readSession()
  if (!session) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)
  }

  // Charge les claims de l'utilisateur connecté (par owner_id).
  const { rows } = await pool.query(
    `select c.ts, c.title, c.cert_url, c.price_cents, c.currency
       from claims c
       where c.owner_id = $1
       order by c.ts desc
       limit 200`,
    [session.ownerId]
  )

  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: rows[0]?.currency || 'EUR' })

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px', fontFamily: 'Inter, system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{locale.startsWith('fr') ? 'Mon compte' : 'My account'}</h1>
        <form action={`/${locale}/explore`} style={{ display: 'flex', gap: 10 }}>
          <a href={`/${locale}`} style={{ textDecoration: 'none' }}>
            {locale.startsWith('fr') ? 'Accueil' : 'Home'}
          </a>
        </form>
      </header>

      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            {locale.startsWith('fr') ? 'Connecté en tant que' : 'Signed in as'}
          </div>
          <div style={{ fontWeight: 700 }}>{session.displayName || session.email}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{session.email}</div>
        </div>

        <form method="POST" action={`/api/auth/logout?locale=${encodeURIComponent(locale)}`}>
          <button
            type="submit"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: 'white',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {locale.startsWith('fr') ? 'Se déconnecter' : 'Sign out'}
          </button>
        </form>
      </section>

      <h2 style={{ marginTop: 0 }}>{locale.startsWith('fr') ? 'Mes certificats' : 'My certificates'}</h2>

      {rows.length === 0 ? (
        <p style={{ opacity: 0.8 }}>
          {locale.startsWith('fr')
            ? "Vous n'avez pas encore de certificat."
            : "You don't have any certificate yet."}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {rows.map((r: any) => {
            const day = new Date(r.ts).toISOString().slice(0, 10)
            const href = `/${locale}/m/${encodeURIComponent(day)}`
            return (
              <a
                key={r.ts}
                href={href}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 14,
                  color: '#111827',
                  background: '#fff',
                }}
              >
                <div style={{ fontWeight: 700 }}>{day}</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{r.title || '—'}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  {typeof r.price_cents === 'number' ? fmt.format(r.price_cents / 100) : ''}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </main>
  )
}
