//app/%5Blocale%5D/explore/RegistryClient.tsx
'use client'

import { useMemo, useState, useEffect, useRef } from 'react'

type StyleId =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation' | 'custom'

type RegistryRow = {
  ts: string
  owner: string
  title: string | null
  message: string | null
  style: StyleId | string
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
  '--shadow-elev2': '0 18px 60px rgba(0,0,0,.55)',
} as const

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Gate simple pour limiter le nombre d'iframes actives simultanément */
let __activeIframes = 0
const MAX_ACTIVE_IFRAMES = 8

export default function RegistryClient({
  locale,
  initialItems
}: { locale: string; initialItems: RegistryRow[] }) {
  const loc = (locale || 'en') as string
  const [items, setItems] = useState<RegistryRow[]>(initialItems)
  const [loading, setLoading] = useState(initialItems.length === 0)
  const [error, setError] = useState<string>('')

  // Backoff si liste vide (publication fraîche / cold start)
  useEffect(() => {
    let cancelled = false
    let attempt = 0
    const delays = [800, 1600, 3200, 5000] // ~10s total

    const load = async () => {
      try {
        setLoading(true); setError('')
        const res = await fetch(`/api/registry?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('HTTP '+res.status)
        const data: RegistryRow[] = await res.json()
        if (cancelled) return
        const clean = Array.isArray(data) ? data : []
        setItems(clean)

        if (clean.length === 0 && attempt < delays.length) {
          const t = delays[attempt++]
          setTimeout(() => { if (!cancelled) load() }, t)
        }
      } catch {
        if (!cancelled) setError('Impossible de charger le registre public.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (initialItems.length === 0) load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        background:'radial-gradient(1200px 800px at 10% -10%, rgba(228,183,61,.06), transparent 60%), radial-gradient(1000px 700px at 90% 0%, rgba(255,255,255,.04), transparent 60%), var(--color-bg)',
        color:'var(--color-text)',
        minHeight:'100vh',
        fontFamily:'Inter, system-ui',
      }}
    >
      <section style={{maxWidth:1280, margin:'0 auto', padding:'56px 24px 64px'}}>
        {/* Header */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
          <a href={`/${loc}`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; Parcels of Time</a>
          <a href={`/${loc}/claim`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85, border:'1px solid var(--color-border)', padding:'8px 12px', borderRadius:12}}>
            Contribuer une œuvre →
          </a>
        </div>

        {/* Manifeste / Hero */}
        <header style={{marginBottom:20}}>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:46, lineHeight:'54px', margin:'0 0 10px', letterSpacing:.2}}>
            Registre public — œuvres de la minute
          </h1>
          <p style={{margin:'0 0 10px', maxWidth:900, opacity:.92, fontSize:16, lineHeight:'24px'}}>
            Une exposition vivante et bienveillante des instants qui nous portent. Chaque pièce est un
            <strong> certificat intégral</strong> publié volontairement — une nouvelle forme d’art participatif numérique pour
            inspirer par les réussites, les liens et les bonheurs partagés.
          </p>
          <p style={{margin:0, maxWidth:900, opacity:.65, fontSize:13}}>
            Les œuvres demeurent la propriété de leurs auteur·rice·s. Consultation uniquement. Pas de téléchargement ni d’export.
          </p>
        </header>

        {loading ? (
          <div style={{marginTop:24, opacity:.8}}>Chargement du registre…</div>
        ) : error ? (
          <div style={{marginTop:24, color:'#ffb2b2', border:'1px solid #ff8a8a', background:'rgba(255,0,0,.06)', padding:12, borderRadius:12}}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{marginTop:24, opacity:.8}}>Aucune œuvre publique pour le moment.</div>
        ) : (
          <CurationBar items={items} />
        )}
      </section>
    </main>
  )
}

/* ---------------- Client subcomponents ---------------- */

function CurationBar({ items }: { items: RegistryRow[] }) {
  const [q, setQ] = useState('')
  const [view, setView] = useState<'wall'|'salon'>('wall')
  const [list, setList] = useState<RegistryRow[]>(items)
  const total = list.length

  return (
    <>
      <div style={{
        display:'grid', gridTemplateColumns:'1fr auto auto', gap:10,
        alignItems:'center', margin:'18px 0 16px'
      }}>
        <input
          placeholder="Rechercher une émotion, un titre, un prénom, une minute…"
          value={q} onChange={e=>setQ(e.target.value)}
          style={{
            padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:12,
            background:'linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.00))',
            color:'var(--color-text)'
          }}
        />
        <button onClick={()=>setList(s=>shuffle(s))}
          style={{padding:'10px 12px', borderRadius:10, background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)'}}>
          Inspiration aléatoire
        </button>
        <button onClick={()=>setView(v=>v==='wall'?'salon':'wall')}
          style={{padding:'10px 12px', borderRadius:10, background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)'}}>
          {view==='wall' ? 'Mur — mosaïque' : 'Salon — œuvres larges'}
        </button>
      </div>
      <RegistryGalleryControls q={q} setQ={setQ} view={view} />
      <RegistryWall key={view} view={view} q={q} items={list} total={total} />
    </>
  )
}

/** Petit bandeau de stats / filtres sémantiques (non-intrusif) */
function RegistryGalleryControls({ q, setQ, view }:{
  q:string; setQ:(s:string)=>void; view:'wall'|'salon'
}) {
  const chips = ['Amour','Réussite','Naissance','Mariage','Fête','Courage','Hasard heureux']
  return (
    <div style={{display:'flex', gap:8, alignItems:'center', margin:'6px 0 12px', flexWrap:'wrap'}}>
      <span style={{fontSize:12, color:'var(--color-muted)'}}>Curations :</span>
      {chips.map(t=>(
        <button
          key={t}
          onClick={()=>{
            const selected = q.toLowerCase()===t.toLowerCase()
            setQ(selected ? '' : t)
          }}
          style={{
            fontSize:12, padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:999,
            background: q.toLowerCase()===t.toLowerCase() ? 'rgba(228,183,61,.18)' : 'var(--color-surface)',
            color:'var(--color-text)'
          }}>
          {t}
        </button>
      ))}
      <span style={{marginLeft:'auto', fontSize:12, color:'var(--color-muted)'}}>
        {view==='wall' ? 'Mur — mosaïque' : 'Salon — œuvres larges'}
      </span>
    </div>
  )
}

function RegistryWall({ items, q, view, total }:{
  items:RegistryRow[]; q:string; view:'wall'|'salon'; total:number
}) {
  const filtered = useMemo(()=>{
    const s = q.trim().toLowerCase()
    if(!s) return items
    return items.filter(it =>
      (it.owner || '').toLowerCase().includes(s) ||
      (it.title || '').toLowerCase().includes(s) ||
      (it.message || '').toLowerCase().includes(s) ||
      it.ts.toLowerCase().includes(s)
    )
  }, [q, items])

  // Les deux vues utilisent des PDF iframes (vrai rendu : titres + fonds custom)
  const tall = view === 'salon'

  return (
    <>
      <div style={{fontSize:12, color:'var(--color-muted)', margin:'2px 0 10px'}}>
        {filtered.length} œuvre{filtered.length>1?'s':''} {filtered.length!==total && <>— <span style={{opacity:.75}}>filtrées</span></>}
      </div>

      <div
        style={{
          display:'grid',
          gridTemplateColumns: tall ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: tall ? 26 : 22,
          alignItems:'stretch'
        }}
      >
        {filtered.map((row, i) => (
          <RegistryCard
            key={row.ts}
            row={row}
            tall={tall}
            // priorité aux 6 premières cartes pour une première vue rapide
            priority={i < 6}
          />
        ))}
        {filtered.length===0 && <p style={{opacity:.7, gridColumn:'1 / -1'}}>Aucun résultat.</p>}
      </div>
    </>
  )
}

function RegistryCard(
  { row, style, tall, priority }:
  { row:RegistryRow; style?:React.CSSProperties; tall?:boolean; priority?:boolean }
) {
  // PDF public, sans métadonnées périphériques, avec contenu réel (titres/messages/fonds custom)
  const pdfHref =
    `/api/cert/${encodeURIComponent(row.ts)}?public=1&hide_meta=1#view=FitH&toolbar=0&navpanes=0&scrollbar=0`

  return (
    <article
      onContextMenu={(e)=>e.preventDefault()}
      style={{
        ...style,
        position:'relative',
        borderRadius:18,
        padding:12,
        background:'linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.00))',
        border:'1px solid var(--color-border)',
        boxShadow: tall ? 'var(--shadow-elev2)' : 'var(--shadow-elev1)',
        transform:'translateY(0)',
        transition:'transform .35s cubic-bezier(.2,.9,.2,1), box-shadow .35s',
        willChange:'transform',
      }}
    >
      <div style={{
        position:'relative',
        width:'100%',
        aspectRatio:'595/842',
        background:'#0E1017',
        borderRadius:12,
        overflow:'hidden',
        border:'1px solid rgba(255,255,255,.06)',
        boxShadow:'inset 0 0 0 1px rgba(0,0,0,.35)',
      }}>
        <LazyIframe src={pdfHref} priority={!!priority} />

        {/* voile artistique */}
        <div style={{
          position:'absolute', inset:0,
          background:'radial-gradient(120% 80% at 50% -10%, transparent 40%, rgba(0,0,0,.18) 100%)',
          pointerEvents:'none'
        }} />

        {/* ✅ Badge Authentifié */}
        <div
          aria-label="Certificat authentifié"
          style={{
            position:'absolute', left:8, bottom:8,
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'6px 8px', borderRadius:999,
            background:'rgba(14,170,80,.18)',
            border:'1px solid rgba(14,170,80,.45)',
            color:'#D9FBE3', fontSize:12, fontWeight:700,
            pointerEvents:'none'
          }}
        >
          <span>Authentifié</span><span aria-hidden>✓</span>
        </div>

        {/* légende discrète */}
        <figcaption
          style={{
            position:'absolute', left:0, right:0, bottom:0,
            padding:'12px 14px',
            background:'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.65) 100%)',
            color:'#fff',
            fontSize:12,
            opacity:.0,
            transform:'translateY(6px)',
            transition:'opacity .35s ease, transform .35s ease',
            pointerEvents:'none'
          }}
        >
          <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12}}>
            <div style={{fontWeight:800, letterSpacing:.2}}>
              {row.owner || 'Anonymous'}
            </div>
            <div style={{opacity:.85}}>
              {row.ts.replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC')}
            </div>
          </div>
          {(row.title || row.message) && (
            <div style={{marginTop:6, opacity:.95, fontStyle: row.message ? 'italic' : 'normal'}}>
              {row.title || `“${row.message}”`}
            </div>
          )}
        </figcaption>
      </div>

      {/* hover effects */}
      <style>{`
        article:hover { transform: translateY(-4px); box-shadow: 0 18px 60px rgba(0,0,0,.55); }
        article:hover figcaption { opacity: 1; transform: translateY(0); }
      `}</style>
    </article>
  )
}

/* --- Iframe lazy + gate de concurrence + skeleton --- */
function LazyIframe({ src, priority }: { src: string; priority: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [mount, setMount] = useState<boolean>(priority)

  useEffect(() => {
    if (priority) return setMount(true)

    const el = ref.current
    if (!el) return

    let claimed = false
    const tryClaim = () => {
      if (!claimed && __activeIframes < MAX_ACTIVE_IFRAMES) {
        __activeIframes += 1
        claimed = true
        setMount(true)
      }
    }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        // pré-monte quand visible (ou proche) + gate
        tryClaim()
      }
    }, { rootMargin: '400px' })

    io.observe(el)
    return () => {
      io.disconnect()
      if (claimed) __activeIframes = Math.max(0, __activeIframes - 1)
    }
  }, [priority])

  return (
    <div ref={ref} style={{position:'absolute', inset:0}}>
      {mount ? (
        <iframe
          src={src}
          title="Œuvre"
          loading="lazy"
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%', border:'0',
            pointerEvents:'none', userSelect:'none'
          }}
        />
      ) : (
        // Skeleton léger (image dégradée) le temps de monter l’iframe
        <div
          style={{
            position:'absolute', inset:0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.00)),' +
              'radial-gradient(80% 60% at 50% 10%, rgba(255,255,255,.06), rgba(0,0,0,.0) 60%),' +
              '#0E1017'
          }}
        />
      )}
    </div>
  )
}
