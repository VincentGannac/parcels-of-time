// app/[locale]/explore/page.tsx
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
        ) : (
          <CurationBar items={items} onShuffle={()=>setItems(s=>shuffle(s))} />
        )}
      </section>
    </main>
  )
}

/* ---------------- Client subcomponents ---------------- */

function CurationBar({ items, onShuffle }:{ items: RegistryRow[]; onShuffle:()=>void }) {
  const [q, setQ] = useState('')
  const [view, setView] = useState<'wall'|'salon'>('wall')
  const total = items.length

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
        <button onClick={onShuffle}
          style={{padding:'10px 12px', borderRadius:10, background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)'}}>
          Inspiration aléatoire
        </button>
        <button onClick={()=>setView(v=>v==='wall'?'salon':'wall')}
          style={{padding:'10px 12px', borderRadius:10, background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)'}}>
          {view==='wall' ? 'Mode Salon' : 'Mode Mur'}
        </button>
      </div>
      <RegistryGalleryControls q={q} setQ={setQ} view={view} />
      <RegistryWall key={view} view={view} q={q} items={items} total={total} />
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

  if (view === 'salon') {
    return (
      <div aria-live="polite" style={{marginTop:6}}>
        {filtered.map((row) => (
          <RegistryCard
            key={row.ts}
            row={row}
            style={{ margin:'0 0 32px', boxShadow:'var(--shadow-elev2)' }}
            tall
          />
        ))}
        {filtered.length===0 && <p style={{opacity:.7}}>Aucun résultat.</p>}
      </div>
    )
  }

  // --- dans RegistryWall, branche "Mur (mosaïque)" ---
return (
  <>
    <div style={{fontSize:12, color:'var(--color-muted)', margin:'2px 0 10px'}}>
      {filtered.length} œuvre{filtered.length>1?'s':''} {filtered.length!==total && <>— <span style={{opacity:.75}}>filtrées</span></>}
    </div>

    {/* Grille à tuiles uniformes */}
    <div
      style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))',
        gap:18,
        alignItems:'stretch'
      }}
    >
      {filtered.map((row) => (
        <RegistryCard
          key={row.ts}
          row={row}
          /* ✅ toutes les tuiles même aspect-ratio */
          tall={false}
        />
      ))}
      {filtered.length===0 && <p style={{opacity:.7, gridColumn:'1 / -1'}}>Aucun résultat.</p>}
    </div>
  </>
)
}


function RegistryCard(
  { row, style, tall }:
  { row:RegistryRow; style?:React.CSSProperties; tall?:boolean }
) {
  // PDF en mode public, sans interaction ni export
  const pdfHref = `/api/cert/${encodeURIComponent(row.ts)}?public=1#view=FitH&toolbar=0&navpanes=0&scrollbar=0`

  return (
    <article
      onContextMenu={(e)=>e.preventDefault()}
      style={{
        ...style,
        position:'relative',
        borderRadius:18,
        padding:12,                       // passe-partout
        background:'linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.00))',
        border:'1px solid var(--color-border)',
        boxShadow:'var(--shadow-elev1)',
        transform:'translateY(0)',
        transition:'transform .35s cubic-bezier(.2,.9,.2,1), box-shadow .35s',
        willChange:'transform',
      }}
    >
      {/* cadre intérieur */}
      <div style={{
        position:'relative',
        width:'100%',
        aspectRatio: tall ? '595/842' : '420/595',
        background:'#0E1017',
        borderRadius:12,
        overflow:'hidden',
        border:'1px solid rgba(255,255,255,.06)',
        boxShadow:'inset 0 0 0 1px rgba(0,0,0,.35)',
      }}>
        <iframe
          src={pdfHref}
          title={`Œuvre ${row.ts}`}
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%', border:'0',
            pointerEvents:'none', // ❌ pas d’interaction
            userSelect:'none'
          }}
        />
        {/* voile artistique */}
        <div style={{
          position:'absolute', inset:0,
          background:'radial-gradient(120% 80% at 50% -10%, transparent 40%, rgba(0,0,0,.18) 100%)',
          pointerEvents:'none'
        }} />
        {/* légende discrète (affichée au survol) */}
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
