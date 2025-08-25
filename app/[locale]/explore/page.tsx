//app/[locale]/explore/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type StyleId =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation' | 'custom'

type RegistryRow = {
  ts: string
  owner: string
  title: string | null
  message: string | null
  style: StyleId
  is_public: boolean
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

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function PublicRegistryPage() {
  const { locale } = useParams<{ locale: string }>()
  const loc = (locale || 'en') as string

  const [items, setItems] = useState<RegistryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true); setError('')
        const res = await fetch('/api/registry', { cache: 'no-store' })
        if (!res.ok) throw new Error('HTTP '+res.status)
        const data: RegistryRow[] = await res.json()
        if (!cancelled) setItems(Array.isArray(data) ? data.filter(i => i.is_public) : [])
      } catch {
        if (!cancelled) setError('Impossible de charger le registre public.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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
        background:'var(--color-bg)', color:'var(--color-text)', minHeight:'100vh', fontFamily:'Inter, system-ui',
      }}
    >
      <section style={{maxWidth:1280, margin:'0 auto', padding:'48px 24px'}}>
        {/* Header */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
          <a href={`/${loc}`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; Parcels of Time</a>
          <a href={`/${loc}/claim`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>Réserver une minute →</a>
        </div>

        <header style={{marginBottom:16}}>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:42, lineHeight:'50px', margin:'0 0 8px'}}>
            Registre public — Art de la minute
          </h1>
          <p style={{margin:0, maxWidth:820, opacity:.92}}>
            Une exposition vivante et anonyme des instants qui comptent. Chaque PDF présenté ici est un
            <strong> certificat complet</strong> — fond, prénom/initiales, titre, message — publié volontairement par son·sa propriétaire.
            C’est de l’art : célébrer l’amour, la réussite, la famille, le courage. Merci de regarder avec bienveillance. 💛
          </p>
        </header>

        <RegistryControls onShuffle={()=>setItems(s=>shuffle(s))} />

        {loading ? (
          <div style={{marginTop:20, opacity:.8}}>Chargement du registre…</div>
        ) : error ? (
          <div style={{marginTop:20, color:'#ffb2b2', border:'1px solid #ff8a8a', background:'rgba(255,0,0,.06)', padding:12, borderRadius:12}}>
            {error}
          </div>
        ) : (
          <RegistryGallery initialItems={items} locale={loc} />
        )}
      </section>
    </main>
  )
}

/* ---------------- Client subcomponents ---------------- */

function RegistryControls({ onShuffle }:{ onShuffle:()=>void }) {
  return (
    <div style={{display:'flex', gap:10, alignItems:'center', margin:'14px 0 10px', flexWrap:'wrap'}}>
      <span style={{fontSize:12, color:'var(--color-muted)'}}>Curations : </span>
      {['Amour','Réussite','Naissance','Mariage','Fête','Voyage','Hasard heureux'].map(t=>(
        <span key={t} style={{fontSize:12, padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:999, background:'var(--color-surface)'}}>{t}</span>
      ))}
      <button onClick={onShuffle}
        style={{marginLeft:'auto', padding:'8px 12px', borderRadius:10, background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)'}}>
        Mélanger l’ordre
      </button>
    </div>
  )
}

function RegistryGallery({ initialItems, locale }:{ initialItems: RegistryRow[]; locale:string }) {
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid'|'flow'>('grid')

  const filtered = useMemo(()=>{
    const s = q.trim().toLowerCase()
    if(!s) return initialItems
    return initialItems.filter(it =>
      (it.owner || '').toLowerCase().includes(s) ||
      (it.title || '').toLowerCase().includes(s) ||
      (it.message || '').toLowerCase().includes(s) ||
      it.ts.toLowerCase().includes(s)
    )
  }, [q, initialItems])

  return (
    <>
      <div style={{display:'flex', gap:10, alignItems:'center', margin:'6px 0 14px', flexWrap:'wrap'}}>
        <input
          placeholder="Rechercher (propriétaire, titre, message, minute)…"
          value={q} onChange={e=>setQ(e.target.value)}
          style={{flex:'1 1 420px', padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:12, background:'var(--color-surface)', color:'var(--color-text)'}}
        />
        <button onClick={()=>setView(v=>v==='grid'?'flow':'grid')}
          style={{padding:'10px 12px', borderRadius:10, background:'var(--color-surface)', color:'var(--color-text)', border:'1px solid var(--color-border)'}}>
          {view==='grid' ? 'Mode exposition' : 'Mode grille'}
        </button>
      </div>

      {view==='grid' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:16 }}>
          {filtered.map(row => (
            <RegistryCard key={row.ts} row={row} style={{gridColumn:'span 4'}} tall={false} locale={locale} />
          ))}
          {filtered.length===0 && <p style={{opacity:.7, gridColumn:'span 12'}}>Aucun résultat.</p>}
        </div>
      ) : (
        <div aria-live="polite">
          {filtered.map(row => (
            <RegistryCard key={row.ts} row={row} style={{margin:'0 0 30px'}} tall locale={locale} />
          ))}
        </div>
      )}
    </>
  )
}

function RegistryCard(
  { row, style, tall, locale }:
  { row:RegistryRow; style?:React.CSSProperties; tall?:boolean; locale:string }
) {
  // ✅ PDF en mode public (QR masqué)
  const pdfHref = `/api/cert/${encodeURIComponent(row.ts)}?public=1`
  const pageHref = `/${locale}/m/${encodeURIComponent(row.ts)}`
  return (
    <article style={{
      ...style,
      border:'1px solid var(--color-border)', borderRadius:16, overflow:'hidden',
      background:'var(--color-surface)', boxShadow:'var(--shadow-elev1)'
    }}>
      <div style={{position:'relative', width:'100%', aspectRatio: tall ? '595/842' : '420/595', background:'#0E1017'}}>
        <iframe
          src={`${pdfHref}#view=FitH`}
          title={`Certificat ${row.ts}`}
          style={{position:'absolute', inset:0, width:'100%', height:'100%', border:'0'}}
        />
        <div style={{
          position:'absolute', inset:0, background:'linear-gradient(180deg, transparent, transparent, rgba(0,0,0,.25) 88%)',
          pointerEvents:'none'
        }} />
      </div>

      <div style={{padding:12}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:12, opacity:.7}}>Owned by</div>
            <div style={{fontWeight:800}}>{row.owner || 'Anonymous'}</div>
          </div>
          <a href={pageHref} style={{fontSize:12, textDecoration:'none', color:'var(--color-text)', opacity:.85}}>Ouvrir la page →</a>
        </div>

        {row.title && <div style={{marginTop:8}}><strong style={{fontSize:14}}>{row.title}</strong></div>}
        {row.message && <p style={{margin:'6px 0 0', fontStyle:'italic', opacity:.95}}>“{row.message}”</p>}

        <div style={{display:'flex', gap:8, marginTop:12}}>
          <a href={pdfHref} target="_blank"
             style={{textDecoration:'none', padding:'10px 12px', borderRadius:10, background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800}}>
            Ouvrir le PDF
          </a>
          <button onClick={()=>navigator.clipboard?.writeText(pageHref)}
            style={{padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)'}}>
            Copier le lien
          </button>
          <a href={`/${locale}/claim?ts=${encodeURIComponent(row.ts)}`} style={{marginLeft:'auto', fontSize:12, color:'var(--color-text)', opacity:.85, textDecoration:'none'}}>
            Réserver une minute →
          </a>
        </div>
      </div>
    </article>
  )
}
