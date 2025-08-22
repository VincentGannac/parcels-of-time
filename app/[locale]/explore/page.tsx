// app/[locale]/explore/page.tsx
import RegistryClient from './RegistryClient'
import { absoluteUrl } from '@/lib/url'

type RegistryItem = { id: string; ts: string; title?: string|null; message?: string|null }
type RegistryPayload = { items: RegistryItem[]; nextCursor?: string|null }

async function getInitial(qp: { q?: string; hasTitle?: '1'; hasMessage?: '1'; sort?: 'new'|'old' }): Promise<RegistryPayload> {
  try {
    const p = new URLSearchParams({ limit: '24' })
    if (qp.q) p.set('q', qp.q)
    if (qp.hasTitle) p.set('hasTitle', '1')
    if (qp.hasMessage) p.set('hasMessage', '1')
    if (qp.sort === 'old') p.set('sort', 'old')
    const url = await absoluteUrl(`/api/registry?${p.toString()}`)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return { items: [], nextCursor: null }
    return res.json()
  } catch {
    return { items: [], nextCursor: null }
  }
}

const TOKENS = {
  '--bg': '#0B0E14',
  '--surface': '#111726',
  '--text': '#E6EAF2',
  '--muted': '#A7B0C0',
  '--primary': '#E4B73D',
  '--onPrimary': '#0B0E14',
  '--border': '#1E2A3C',
  '--shadow1': '0 10px 32px rgba(0,0,0,.40)',
  '--shadow2': '0 18px 48px rgba(0,0,0,.50)',
} as const

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const sp = (await searchParams) || {}
  const q = typeof sp.q === 'string' ? sp.q : ''
  const hasTitle = sp.hasTitle === '1' ? '1' : undefined
  const hasMessage = sp.hasMessage === '1' ? '1' : undefined
  const sort = sp.sort === 'old' ? 'old' : 'new'

  const initial = await getInitial({ q, hasTitle, hasMessage, sort })

  return (
    <main
      style={{
        ['--bg' as any]: TOKENS['--bg'],
        ['--surface' as any]: TOKENS['--surface'],
        ['--text' as any]: TOKENS['--text'],
        ['--muted' as any]: TOKENS['--muted'],
        ['--primary' as any]: TOKENS['--primary'],
        ['--onPrimary' as any]: TOKENS['--onPrimary'],
        ['--border' as any]: TOKENS['--border'],
        ['--shadow1' as any]: TOKENS['--shadow1'],
        ['--shadow2' as any]: TOKENS['--shadow2'],
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui',
      }}
    >
      {/* Bandeau héro — discret, laisse place à l’“aurora” */}
      <section style={{ position: 'relative', borderBottom: '1px solid var(--border)' }}>
        <div aria-hidden style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:
            'radial-gradient(60% 40% at 12% -10%, rgba(228,183,61,.16), transparent 60%),' +
            'radial-gradient(50% 36% at 84% -8%, rgba(140,214,255,.14), transparent 60%)'
        }}/>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '44px 22px 26px' }}>
          <a href={`/${locale}`} style={{ textDecoration: 'none', color: 'var(--text)', opacity: .85 }}>&larr; Parcels of Time</a>
          <h1 style={{ fontFamily:'Fraunces,serif', fontSize: 50, lineHeight: '56px', margin: '12px 0 8px' }}>
            Détenez une minute pour toujours
          </h1>
          <p style={{ maxWidth: 960, fontSize: 18, lineHeight: '28px', opacity: .96, margin: 0 }}>
            Le registre s’anime à chaque contribution : vos minutes tissent une <em>aurora</em> vivante
            et des <em>sigils</em> abstraits. Exposition anonyme, poétique, collective.
          </p>
        </div>
      </section>

      {/* Client UI */}
      <section style={{ position: 'relative', maxWidth: 1320, margin: '0 auto', padding: '16px 22px 64px' }}>
        <RegistryClient
          initial={initial}
          apiHref="/api/registry"
          locale={locale}
          initialQuery={{ q, hasTitle, hasMessage, sort }}
        />
      </section>

      {/* … footer unchanged … */}
    </main>
  )
}

