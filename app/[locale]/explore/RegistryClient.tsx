'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import type { RegistryRow } from './page'

type StyleId =
  | 'neutral' | 'romantic' | 'birthday' | 'wedding'
  | 'birth'   | 'christmas'| 'newyear'  | 'graduation' | 'custom'

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

export default function RegistryClient({
  locale,
  initialItems
}: { locale: string; initialItems: RegistryRow[] }) {
  const loc = (locale || 'en') as string
  const [items, setItems] = useState<RegistryRow[]>(initialItems)

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

        {items.length === 0 ? (
          <div style={{marginTop:24, opacity:.8}}>Aucune œuvre publique pour le moment.</div>
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

/** Petit bandeau de stats / filtres sémantiques */
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
          <RegistryCard key={row.ts} row={row} style={{ margin:'0 0 32px', boxShadow:'var(--shadow-elev2)' }} tall />
        ))}
        {filtered.length===0 && <p style={{opacity:.7}}>Aucun résultat.</p>}
      </div>
    )
  }

  // --- Mur (mosaïque) : vignettes légères (pas d'iframe) ---
  return (
    <>
      <div style={{fontSize:12, color:'var(--color-muted)', margin:'2px 0 10px'}}>
        {filtered.length} œuvre{filtered.length>1?'s':''} {filtered.length!==total && <>— <span style={{opacity:.75}}>filtrées</span></>}
      </div>

      <div
        style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))',
          gap:22,
          alignItems:'stretch'
        }}
      >
        {filtered.map((row) => (
          <RegistryCard key={row.ts} row={row} tall={false} />
        ))}
        {filtered.length===0 && <p style={{opacity:.7, gridColumn:'1 / -1'}}>Aucun résultat.</p>}
      </div>
    </>
  )
}

function bgThumbForStyle(style: StyleId): string {
  // on tente le thumb, sinon le plein
  return `/cert_bg/${style}_thumb.jpg`
}
function bgFullForStyle(style: StyleId): string {
  return `/cert_bg/${style}.png`
}

function RegistryCard(
  { row, style, tall }:
  { row:RegistryRow; style?:React.CSSProperties; tall?:boolean }
) {
  const pdfHref = `/api/cert/${encodeURIComponent(row.ts)}?public=1&hide_meta=1#view=FitH&toolbar=0&navpanes=0&scrollbar=0`

  // --- Mur : IMG rapide ---
  if (!tall) {
    const thumb = bgThumbForStyle(row.style)
    const full  = bgFullForStyle(row.style)
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
          boxShadow:'var(--shadow-elev1)',
          transform:'translateY(0)',
          transition:'transform .35s cubic-bezier(.2,.9,.2,1), box-shadow .35s',
          willChange:'transform',
        }}
      >
        <a href={`/m/${encodeURIComponent(row.ts)}`} style={{textDecoration:'none'}} aria-label={`Voir ${row.ts}`}>
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
            <img
              src={thumb}
              onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = full }}
              alt={`Fond ${row.style}`}
              loading="lazy"
              style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center'}}
            />
            {/* voile + badge */}
            <div style={{
              position:'absolute', inset:0,
              background:'radial-gradient(120% 80% at 50% -10%, transparent 40%, rgba(0,0,0,.18) 100%)'
            }} />
            <div
              aria-label="Certificat authentifié"
              style={{
                position:'absolute', left:8, bottom:8,
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'6px 8px', borderRadius:999,
                background:'rgba(14,170,80,.18)',
                border:'1px solid rgba(14,170,80,.45)',
                color:'#D9FBE3', fontSize:12, fontWeight:700,
              }}
            >
              <span>Authentifié</span><span aria-hidden>✓</span>
            </div>
            {/* légende courte */}
            <div style={{
              position:'absolute', left:0, right:0, bottom:0,
              padding:'10px 12px',
              background:'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.65) 100%)',
              color:'#fff', fontSize:12,
            }}>
              <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12}}>
                <div style={{fontWeight:800, letterSpacing:.2}}>
                  {row.owner || 'Anonymous'}
                </div>
                <div style={{opacity:.85}}>
                  {row.ts.replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC')}
                </div>
              </div>
              {(row.title || row.message) && (
                <div style={{marginTop:4, opacity:.95, fontStyle: row.message ? 'italic' : 'normal', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                  {row.title || `“${row.message}”`}
                </div>
              )}
            </div>
          </div>
        </a>

        <style>{`
          article:hover { transform: translateY(-4px); box-shadow: 0 18px 60px rgba(0,0,0,.55); }
        `}</style>
      </article>
    )
  }

  // --- Salon : iframe lazy ---
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
        boxShadow:'var(--shadow-elev1)',
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
        <LazyIframe src={pdfHref} />
        <div style={{
          position:'absolute', inset:0,
          background:'radial-gradient(120% 80% at 50% -10%, transparent 40%, rgba(0,0,0,.18) 100%)',
          pointerEvents:'none'
        }} />
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
      </div>
    </article>
  )
}

function LazyIframe({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [mount, setMount] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setMount(true)
        io.disconnect()
      }
    }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} style={{position:'absolute', inset:0}}>
      {mount ? (
        <iframe
          src={src}
          title="Œuvre"
          style={{position:'absolute', inset:0, width:'100%', height:'100%', border:'0'}}
        />
      ) : (
        <div style={{position:'absolute', inset:0, background:'#0E1017'}} />
      )}
    </div>
  )
}
