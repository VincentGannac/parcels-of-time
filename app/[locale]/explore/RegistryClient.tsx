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

/** ---- Marketplace (vente) ---- */
type SaleInfo = { id: string; price_cents: number; currency: string }

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

const pad2 = (n:number) => String(n).padStart(2,'0')
const ymOf = (ymd:string) => ymd.slice(0,7)
const ymd = (y:number,m:number,d:number) => `${y}-${pad2(m)}-${pad2(d)}`
const localeToBCP47 = (loc:string) => (loc?.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US')

/* ----- Gate de lancement des iframes pour éviter la saturation serveur ----- */
let __bootInflight = 0
const MAX_BOOT_CONCURRENCY = 3

export default function RegistryClient({
  locale,
  initialItems
}: { locale: string; initialItems: RegistryRow[] }) {
  const loc = (locale || 'en') as string
  const [items, setItems] = useState<RegistryRow[]>(initialItems)
  const [loading, setLoading] = useState(initialItems.length === 0)
  const [error, setError] = useState<string>('')

  /** ====== Vente : lookup prix par date ====== */
  const [saleMap, setSaleMap] = useState<Record<string, SaleInfo>>({})
  // Cache par mois -> lookup { d -> SaleInfo }
  const monthCacheRef = useRef<Map<string, Record<number, SaleInfo>>>(new Map())

  // Petit refresh client pour résorber les cas "0 œuvre" en SSR
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/registry?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data: RegistryRow[] = await res.json()
        if (!cancelled && Array.isArray(data) && data.length >= items.length) {
          setItems(data)
          setLoading(false)
        }
      } catch {}
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Backoff si la liste initiale est vide
  useEffect(() => {
    if (initialItems.length > 0) return
    let cancelled = false, attempt = 0
    const delays = [800, 1600, 3200, 5000]
    const load = async () => {
      try {
        setLoading(true); setError('')
        const res = await fetch(`/api/registry?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('HTTP '+res.status)
        const data: RegistryRow[] = await res.json()
        if (!cancelled) {
          const clean = Array.isArray(data) ? data : []
          setItems(clean)
          setLoading(false)
          if (clean.length === 0 && attempt < delays.length) {
            setTimeout(() => { if (!cancelled) load() }, delays[attempt++])
          }
        }
      } catch {
        if (!cancelled) { setError('Impossible de charger le registre public.'); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [initialItems.length])

  /** ====== Récupère les annonces (vente) pour tous les mois présents ====== */
  useEffect(() => {
    if (!items.length) return
    let cancelled = false

    const months = Array.from(new Set(items.map(it => ymOf(it.ts))))
    const toFetch = months.filter(m => !monthCacheRef.current.has(m))
    if (toFetch.length === 0) {
      // tout est en cache → hydrate saleMap et sort
      const merged: Record<string, SaleInfo> = {}
      for (const [ym, lookup] of monthCacheRef.current.entries()) {
        for (const dStr of Object.keys(lookup)) {
          const d = Number(dStr)
          merged[ym + '-' + pad2(d)] = lookup[d]
        }
      }
      setSaleMap(merged)
      return
    }

    const CONCURRENCY = 3
    const queue = toFetch.slice()
    const mergedFromFetch: Record<string, SaleInfo> = {}

    const worker = async () => {
      while (queue.length && !cancelled) {
        const ym = queue.shift()!
        try {
          const res = await fetch(`/api/unavailable?ym=${ym}`, { cache: 'no-store' })
          if (!res.ok) { monthCacheRef.current.set(ym, {}); continue }
          const data = await res.json()
          const lookup: Record<number, SaleInfo> = {}
          const listings = Array.isArray(data?.listings) ? data.listings : []
          for (const it of listings) {
            if (typeof it?.d === 'number') {
              const info: SaleInfo = {
                id: String(it.id),
                price_cents: Number(it.price_cents || 0),
                currency: String(it.currency || 'EUR')
              }
              lookup[it.d] = info
              mergedFromFetch[ym + '-' + pad2(it.d)] = info
            }
          }
          monthCacheRef.current.set(ym, lookup)
        } catch {
          monthCacheRef.current.set(ym, {})
        }
      }
    }

    Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
      if (cancelled) return
      // fusionne cache + nouveaux fetchs
      const merged: Record<string, SaleInfo> = {}
      for (const [m, lookup] of monthCacheRef.current.entries()) {
        for (const dStr of Object.keys(lookup)) {
          const d = Number(dStr)
          merged[m + '-' + pad2(d)] = lookup[d]
        }
      }
      setSaleMap(merged)
    })

    return () => { cancelled = true }
  }, [items])

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
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
          <a href={`/${loc}`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; Parcels of Time</a>
          <a href={`/${loc}/claim`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85, border:'1px solid var(--color-border)', padding:'8px 12px', borderRadius:12}}>
            Contribuer une œuvre →
          </a>
        </div>

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

        {/* Avertissement registre public */}
        <div style={{margin:'10px 0 0', padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, fontSize:12, background:'rgba(255,255,255,.03)'}}>
          Les certificats listés ici peuvent contenir des <strong>données personnelles</strong> rendues publiques par leurs auteur·rice·s. 
          Pour signaler un contenu : <a href="mailto:support@parcelsoftime.example" style={{color:'var(--color-text)'}}>support@parcelsoftime.example</a>. 
          Voir <a href={`/${locale}/legal/terms`} style={{color:'var(--color-text)'}}>CGU/CGV</a> et <a href={`/${locale}/legal/privacy`} style={{color:'var(--color-text)'}}>Confidentialité</a>.
        </div>


        {loading ? (
          <div style={{marginTop:24, opacity:.8}}>Chargement du registre…</div>
        ) : error ? (
          <div style={{marginTop:24, color:'#ffb2b2', border:'1px solid #ff8a8a', background:'rgba(255,0,0,.06)', padding:12, borderRadius:12}}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{marginTop:24, opacity:.8}}>Aucune œuvre publique pour le moment.</div>
        ) : (
          <CurationBar items={items} saleMap={saleMap} locale={loc} />
        )}
      </section>
    </main>
  )
}

/* ---------------- Client subcomponents ---------------- */

function CurationBar({ items, saleMap, locale }: { items: RegistryRow[]; saleMap: Record<string, SaleInfo>; locale: string }) {
  const [q, setQ] = useState('')
  const [view, setView] = useState<'wall'|'salon'>('wall')
  const [list, setList] = useState<RegistryRow[]>(items)
  const [saleFilter, setSaleFilter] = useState<'both'|'on'|'off'>('both')
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

      <RegistryGalleryControls q={q} setQ={setQ} view={view} saleFilter={saleFilter} setSaleFilter={setSaleFilter} />

      <RegistryWall
        key={view}
        view={view}
        q={q}
        items={list}
        total={total}
        saleMap={saleMap}
        saleFilter={saleFilter}
        locale={locale}
      />
    </>
  )
}

function RegistryGalleryControls({ q, setQ, view, saleFilter, setSaleFilter }:{
  q:string; setQ:(s:string)=>void; view:'wall'|'salon';
  saleFilter:'both'|'on'|'off'; setSaleFilter:(v:'both'|'on'|'off')=>void
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

      {/* -------- Filtre vente -------- */}
      <div style={{marginLeft:'auto', display:'inline-flex', gap:6, alignItems:'center'}}>
        <span style={{fontSize:12, color:'var(--color-muted)'}}>Filtre :</span>
        <SegmentedTri
          value={saleFilter}
          onChange={setSaleFilter}
          labels={{ both:'Les deux', on:'En vente', off:'Pas en vente' }}
        />
        <span style={{fontSize:12, color:'var(--color-muted)'}}>
          {view==='wall' ? 'Mur — mosaïque' : 'Salon — œuvres larges'}
        </span>
      </div>
    </div>
  )
}

function SegmentedTri({ value, onChange, labels }:{
  value:'both'|'on'|'off'
  onChange:(v:'both'|'on'|'off')=>void
  labels:{ both:string; on:string; off:string }
}) {
  const baseBtn: React.CSSProperties = {
    padding:'6px 10px', border:'1px solid var(--color-border)', cursor:'pointer',
    background:'var(--color-surface)', color:'var(--color-text)'
  }
  return (
    <div role="group" aria-label="Filtrer par statut de vente" style={{display:'inline-grid', gridTemplateColumns:'auto auto auto', borderRadius:999, overflow:'hidden', border:'1px solid var(--color-border)'}}>
      <button onClick={()=>onChange('both')} style={{...baseBtn, fontSize:12, fontWeight:700, background: value==='both' ? 'rgba(228,183,61,.18)' : 'var(--color-surface)'}}>{labels.both}</button>
      <button onClick={()=>onChange('on')}   style={{...baseBtn, fontSize:12, fontWeight:700, background: value==='on'   ? 'rgba(228,183,61,.28)' : 'var(--color-surface)'}}>🟡 {labels.on}</button>
      <button onClick={()=>onChange('off')}  style={{...baseBtn, fontSize:12, fontWeight:700, background: value==='off'  ? 'rgba(255,255,255,.06)' : 'var(--color-surface)'}}>{labels.off}</button>
    </div>
  )
}

function RegistryWall({
  items, q, view, total, saleMap, saleFilter, locale
}:{
  items:RegistryRow[]; q:string; view:'wall'|'salon'; total:number
  saleMap: Record<string, SaleInfo>
  saleFilter: 'both'|'on'|'off'
  locale: string
}) {
  const filtered = useMemo(()=>{
    const s = q.trim().toLowerCase()
    let base = items
    if (saleFilter !== 'both') {
      base = base.filter(it => {
        const onSale = !!saleMap[it.ts]
        return saleFilter === 'on' ? onSale : !onSale
      })
    }
    if(!s) return base
    return base.filter(it =>
      (it.owner || '').toLowerCase().includes(s) ||
      (it.title || '').toLowerCase().includes(s) ||
      (it.message || '').toLowerCase().includes(s) ||
      it.ts.toLowerCase().includes(s)
    )
  }, [q, items, saleMap, saleFilter])

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
            sale={saleMap[row.ts] || null}
            locale={locale}
            tall={tall}
            // on “démarre” les 12 premières très vite; le gate fait le reste
            priority={i < 12}
          />
        ))}
        {filtered.length===0 && <p style={{opacity:.7, gridColumn:'1 / -1'}}>Aucun résultat.</p>}
      </div>
    </>
  )
}

function RegistryCard(
  { row, sale, locale, style, tall, priority }:
  { row:RegistryRow; sale: SaleInfo | null; locale:string; style?:React.CSSProperties; tall?:boolean; priority?:boolean }
) {
  const tsDay =
    /^\d{4}-\d{2}-\d{2}$/.test(row.ts)
      ? row.ts
      : (() => { try { return new Date(row.ts).toISOString().slice(0,10) } catch { return String(row.ts).slice(0,10) } })()

  const pdfHref =
    `/api/cert/${encodeURIComponent(tsDay)}?public=1&hide_meta=1#view=FitH&toolbar=0&navpanes=0&scrollbar=0`

  const clickable = !!sale
  const priceLabel = sale ? formatPrice(sale.price_cents, sale.currency, locale) : ''

  const onCardClick = () => {
    if (!sale) return
    // redirige vers ClientClaim avec la date concernée
    window.location.href = `/${locale}/claim?ts=${encodeURIComponent(tsDay)}`
  }

  return (
    <article
      onContextMenu={(e)=>e.preventDefault()}
      onClick={onCardClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      title={clickable ? `En vente — ${priceLabel}` : undefined}
      style={{
        ...style,
        position:'relative',
        borderRadius:18,
        padding:12,
        background:'linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.00))',
        border: clickable ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        boxShadow: tall ? 'var(--shadow-elev2)' : 'var(--shadow-elev1)',
        transform:'translateY(0)',
        transition:'transform .35s cubic-bezier(.2,.9,.2,1), box-shadow .35s, border-color .2s ease',
        willChange:'transform',
        cursor: clickable ? 'pointer' : 'default',
        outline: clickable ? '0.5px solid rgba(228,183,61,.35)' : 'none'
      }}
      onKeyDown={(e)=>{ if (clickable && (e.key==='Enter' || e.key===' ')) { e.preventDefault(); onCardClick() } }}
    >
      <div style={{
        position:'relative',
        width:'100%',
        aspectRatio:'595/842',
        background:'#0E1017',
        borderRadius:12,
        overflow:'hidden',
        border: clickable ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,.06)',
        boxShadow: clickable ? 'inset 0 0 0 2px rgba(228,183,61,.22), inset 0 0 40px rgba(228,183,61,.15)' : 'inset 0 0 0 1px rgba(0,0,0,.35)',
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

        {/* 💛 Prix — surbrillance si en vente */}
        {sale && (
          <div
            aria-label="En vente"
            style={{
              position:'absolute', right:8, top:8,
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'8px 10px', borderRadius:999,
              background:'linear-gradient(180deg, rgba(228,183,61,.95), rgba(228,183,61,.80))',
              color:'var(--color-on-primary)', fontWeight:900, fontSize:12,
              boxShadow:'0 6px 18px rgba(228,183,61,.35)',
              border:'1px solid rgba(0,0,0,.25)',
              pointerEvents:'none'
            }}
          >
            <span style={{fontWeight:800}}>En vente</span>
            <span style={{opacity:.9}}>•</span>
            <span>{priceLabel}</span>
          </div>
        )}

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
              {tsDay}
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

/* --- Iframe lazy : ne démonte jamais une fois montée + gate de boot --- */
function LazyIframe({ src, priority }: { src: string; priority: boolean }) {
  const holderRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [mounted, setMounted] = useState<boolean>(priority)
  const bootedRef = useRef(false)

  // tente de prendre un "slot" de boot
  const tryBoot = () => {
    if (bootedRef.current || mounted) return
    if (__bootInflight < MAX_BOOT_CONCURRENCY) {
      __bootInflight += 1
      bootedRef.current = true
      setMounted(true)
    }
  }

  // intersection → demande de boot (slot si dispo, sinon attend)
  useEffect(() => {
    if (priority) { tryBoot(); return }
    const el = holderRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) tryBoot()
    }, { rootMargin: '600px', threshold: 0.01 })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priority])

  // libère le slot une fois l'iframe chargée (ou time-out fail-safe)
  useEffect(() => {
    if (!mounted) return
    let released = false
    const release = () => {
      if (released) return
      released = true
      __bootInflight = Math.max(0, __bootInflight - 1)
    }

    const to = window.setTimeout(release, 12000)

    const ifr = iframeRef.current
    if (ifr) {
      const onLoad = () => release()
      ifr.addEventListener('load', onLoad)
      const onError = () => release()
      ifr.addEventListener('error', onError)
      return () => {
        window.clearTimeout(to)
        ifr.removeEventListener('load', onLoad)
        ifr.removeEventListener('error', onError)
        release()
      }
    }
    return () => { window.clearTimeout(to); release() }
  }, [mounted])

  return (
    <div ref={holderRef} style={{position:'absolute', inset:0}}>
      {mounted ? (
        <iframe
          ref={iframeRef}
          src={src}
          title="Œuvre"
          loading="lazy"
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%', border:'0',
            pointerEvents:'none', userSelect:'none'
          }}
        />
      ) : (
        // Skeleton léger le temps de disposer d’un slot de boot
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

/** Format prix localisé (EUR par défaut) */
function formatPrice(cents:number, currency:string, locale:string) {
  try {
    return new Intl.NumberFormat(localeToBCP47(locale), { style:'currency', currency }).format((cents||0)/100)
  } catch {
    // fallback minimal
    const val = Math.round((cents||0)/100)
    return currency?.toUpperCase()==='EUR' ? `${val} €` : `${val} ${currency||''}`.trim()
  }
}
