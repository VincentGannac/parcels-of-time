// app/[locale]/explore/page.tsx
import RegistryClient from './RegistryClient'
import { absoluteUrl } from '@/lib/url'

type RegistryItem = { id: string; ts: string; title?: string|null; message?: string|null }
type RegistryPayload = { items: RegistryItem[]; nextCursor?: string|null }

async function getInitial(): Promise<RegistryPayload> {
  try {
    const url = await absoluteUrl('/api/registry?limit=24')
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return { items: [], nextCursor: null }
    return res.json()
  } catch {
    // Ne casse jamais le rendu de la page
    return { items: [], nextCursor: null }
  }
}

const TOKENS = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-border': '#1E2A3C',
  '--shadow-elev1': '0 6px 20px rgba(0,0,0,.35)',
  '--shadow-elev2': '0 12px 36px rgba(0,0,0,.45)',
} as const

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const initial = await getInitial()

  return (
    <main
      style={{
        ['--color-bg' as any]: TOKENS['--color-bg'],
        ['--color-surface' as any]: TOKENS['--color-surface'],
        ['--color-text' as any]: TOKENS['--color-text'],
        ['--color-muted' as any]: TOKENS['--color-muted'],
        ['--color-primary' as any]: TOKENS['--color-primary'],
        ['--color-on-primary' as any]: TOKENS['--color-on-primary'],
        ['--color-border' as any]: TOKENS['--color-border'],
        ['--shadow-elev1' as any]: TOKENS['--shadow-elev1'],
        ['--shadow-elev2' as any]: TOKENS['--shadow-elev2'],
        background:'var(--color-bg)', color:'var(--color-text)', minHeight:'100vh', fontFamily:'Inter, system-ui'
      }}
    >
      <section style={{position:'relative', borderBottom:'1px solid var(--color-border)'}}>
        <div aria-hidden style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background: 'radial-gradient(60% 40% at 20% -10%, rgba(228,183,61,.16), transparent 60%), radial-gradient(54% 36% at 80% -8%, rgba(140,214,255,.14), transparent 60%)'
        }} />
        <div style={{maxWidth:1280, margin:'0 auto', padding:'48px 24px 28px'}}>
          <a href={`/${locale}`} style={{ textDecoration:'none', color:'var(--color-text)', opacity:.85 }}>&larr; Parcels of Time</a>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:48, lineHeight:'54px', margin:'12px 0 10px'}}>Registre public</h1>
          <p style={{maxWidth:860, fontSize:18, lineHeight:'28px', opacity:.95, margin:0}}>
            Une œuvre collective, anonyme, dédiée aux <strong>réussites</strong> et à <strong>l’amour</strong>. Ici, seuls les éléments rendus publics par les propriétaires sont affichés : <em>minute UTC</em>, <em>ID</em>, <em>titre</em> et <em>message</em>.
          </p>
        </div>
      </section>

      <section style={{maxWidth:1280, margin:'0 auto', padding:'20px 24px 56px'}}>
        {/* Passe la locale pour préfixer tous les liens internes */}
        <RegistryClient initial={initial} apiHref="/api/registry" locale={locale} />
      </section>

      <footer style={{borderTop:'1px solid var(--color-border)', color:'var(--color-muted)'}}>
        <div style={{maxWidth:1280, margin:'0 auto', padding:'16px 24px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10}}>
          <span>© {new Date().getFullYear()} Parcels of Time</span>
          <div style={{display:'flex', gap:14}}>
            <a href={`/${locale}/claim`} style={{textDecoration:'none', color:'inherit'}}>Réserver une minute</a>
            <a href={`/${locale}/claim?gift=1`} style={{textDecoration:'none', color:'inherit'}}>Offrir</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
