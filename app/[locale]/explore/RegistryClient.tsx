// app/[locale]/explore/RegistryClient.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** -------------------------------------------
 * Types / charges utiles
 * ------------------------------------------*/
type RegistryItem = { id: string; ts: string; title?: string|null; message?: string|null }
type RegistryPayload = { items: RegistryItem[]; nextCursor?: string|null }

type InitialQuery = { q?: string; hasTitle?: '1'; hasMessage?: '1'; sort?: 'new'|'old' }

function niceUTC(iso: string) {
  return iso.replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC')
}

/** -------------------------------------------
 * PRNG + ART HASH (local, non-réidentifiant)
 * - seed = `${id}|${ts}`
 * - palettes, angle, variant dérivés localement
 * ------------------------------------------*/
function fnv1a(str: string) {
  let h = 0x811c9dc5
  for (let i=0; i<str.length; i++) { h ^= str.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24) }
  return h >>> 0
}
function mulberry32(a: number) {
  return function() { let t = (a += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
type Palette = readonly [string, string, string, string] // 4 tons
const PALETTES: Palette[] = [
  ['#F4E7C5','#E4B73D','#B86E1B','#2B1E0C'], // sable/ambre
  ['#F2E9E4','#F4B6C2','#B56576','#2D1B2E'], // rosés
  ['#EEF5FF','#8CD6FF','#3B82F6','#0B1020'], // auroral froid
  ['#F8F4EC','#C4E7D4','#5BBF9B','#0C1F1A'], // jade
  ['#F9F1FF','#D6C7FF','#8C7BFF','#1A1630'], // violets
  ['#FFF6EA','#FFD8C2','#FF9F6E','#2C1410'], // orangés
] as const
function artHashFor(item: RegistryItem) {
  const seed = `${item.id}|${item.ts}`
  const h = fnv1a(seed)
  const rng = mulberry32(h)
  const pal = PALETTES[Math.floor(rng() * PALETTES.length)]
  const angle = Math.floor(rng()*360)
  const variant = Math.floor(rng()*9999)
  return { palette: pal, angle, variant }
}

/** -------------------------------------------
 * Détection d'intentions (opt-in décoratif)
 * ------------------------------------------*/
const LOVE = ['love','amour','❤','❤️','heart','couple','kisses','bisou','baiser','mariage','wedding']
const JOY  = ['happy','joie','bonheur','yay','🎉','🎊','cheers']
const WIN  = ['win','victoire','réussite','bravo','🏆','success','congrats','félicitations']
function intentionBadges(title?: string|null, message?: string|null) {
  const src = `${title||''} ${message||''}`.toLowerCase()
  const has = (arr:string[]) => arr.some(w => src.includes(w))
  return {
    love: has(LOVE),
    joy:  has(JOY),
    win:  has(WIN),
  }
}

/** -------------------------------------------
 * Aurora : fond vivant agrégé
 * - agrège les palettes des items visibles
 * - anime en douceur via CSS variables
 * ------------------------------------------*/
// 1) Replace the old function:
function mixHex(color1: string, color2: string, t: number): string {
  const p1 = parseInt(color1.slice(1), 16)
  const p2 = parseInt(color2.slice(1), 16)

  const r1 = (p1 >> 16) & 255, g1 = (p1 >> 8) & 255, b1 = p1 & 255
  const r2 = (p2 >> 16) & 255, g2 = (p2 >> 8) & 255, b2 = p2 & 255

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  const combined = (r << 16) | (g << 8) | b
  return `#${combined.toString(16).padStart(6, '0')}`
}


function Aurora({ swatches }:{ swatches: string[] }) {
  const ref = useRef<HTMLDivElement|null>(null)
  // on anime un angle + on interpole deux couleurs
  useEffect(()=>{
    let raf = 0, t0 = performance.now()
    function tick(now:number){
      const t = (now - t0) / 8000 // 8s cycle
      const a = (t*360)%360
      const c1 = swatches[0] || '#2a2233'
      const c2 = swatches[1] || '#0b1020'
      const mix01 = (Math.sin(t*2*Math.PI)*0.5+0.5)*0.7
      const c = mixHex(c1, c2, mix01)
      const el = ref.current
      if (el) {
        el.style.setProperty('--aurora-angle', `${a.toFixed(2)}deg`)
        el.style.setProperty('--aurora-color', c)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return ()=> cancelAnimationFrame(raf)
  }, [swatches])
  return (
    <div aria-hidden ref={ref} style={{
      position:'absolute', inset:0, pointerEvents:'none',
      background:
        'radial-gradient(40% 28% at 18% -8%, color-mix(in srgb, var(--aurora-color) 40%, transparent), transparent 60%),' +
        'radial-gradient(40% 28% at 82% -6%, color-mix(in srgb, var(--aurora-color) 28%, transparent), transparent 60%),' +
        'conic-gradient(from var(--aurora-angle), transparent 0 40deg, rgba(255,255,255,.04) 40deg 60deg, transparent 60deg 360deg)'
    }}/>
  )
}

/** -------------------------------------------
 * Carte artistique (sigil + métadonnées publiques)
 * - Deux modes : “card” (lisible) & “mosaic” (très artistique)
 * ------------------------------------------*/
function Sigil({ item }:{ item: RegistryItem }) {
  const { palette, angle, variant } = useMemo(()=>artHashFor(item),[item.id,item.ts])
  const soft = (a:number)=>a.toFixed(2)
  // blob multi-radial
  const bg = `radial-gradient(circle at 30% 34%, ${palette[0]}AA 0%, transparent 42%),
              radial-gradient(circle at 72% 22%, ${palette[1]}AA 0%, transparent 46%),
              radial-gradient(circle at 60% 70%, ${palette[2]}AA 0%, transparent 44%),
              radial-gradient(circle at 20% 70%, ${palette[3]}99 0%, transparent 50%)`
  return (
    <div aria-hidden style={{
      position:'absolute', inset:0, borderRadius:14,
      background: bg,
      transform: `rotate(${angle}deg) scale(${1 + (variant%7)/80})`,
      filter:'blur(6px) saturate(1.08)',
      opacity:.9,
    }}/>
  )
}

function ArtCard({ e, locale, mode }:{ e:RegistryItem; locale:string; mode:'card'|'mosaic' }) {
  const href = `/${locale}/m/${encodeURIComponent(e.ts)}`
  const subtle = 'rgba(26,31,42,.74)'
  const badges = intentionBadges(e.title, e.message)

  if (mode==='mosaic') {
    // Variante très artistique (peu de texte)
    return (
      <a href={href} aria-label="Ouvrir la minute" style={{ textDecoration:'none', color:'inherit' }}>
        <div role="article" style={{
          position:'relative', height:300, border:'1px solid var(--border)',
          borderRadius:16, overflow:'hidden', background:'#0E1017', boxShadow:'var(--shadow1)'
        }}>
          <Sigil item={e}/>
          <div style={{
            position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,.0), rgba(0,0,0,.22))'
          }}/>
          <div style={{ position:'absolute', bottom:12, left:12, right:12 }}>
            <div style={{ fontSize:14, color:'#dfe6f1', opacity:.95, textShadow:'0 1px 10px rgba(0,0,0,.45)' }}>
              {niceUTC(e.ts)}
            </div>
            {(e.title || e.message) && (
              <div style={{ marginTop:6, fontWeight:800, fontSize:16, color:'#fff', textShadow:'0 1px 12px rgba(0,0,0,.5)' }}>
                {e.title || e.message}
              </div>
            )}
          </div>
        </div>
      </a>
    )
  }

  // Mode “card” (lisible)
  const idShort = e.id.length > 20 ? e.id.slice(0, 8) + '…' + e.id.slice(-4) : e.id
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text) } catch {} }
  const share = async () => {
    const url = location.origin + href
    try {
      if (navigator.share) await navigator.share({ title:'Parcels of Time — Public Registry', text: e.title || e.message || niceUTC(e.ts), url })
      else await navigator.clipboard.writeText(url)
    } catch {}
  }

  return (
    <article style={{
      display:'grid', gridTemplateRows:'auto 1fr auto',
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow1)'
    }}>
      <a href={href} aria-label="Voir la minute" style={{ textDecoration:'none', color:'inherit' }}>
        <div style={{ position:'relative', width:'100%', aspectRatio:'595/842', background:'#0E1017' }}>
          <Sigil item={e}/>
          <div aria-hidden style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,.0), rgba(0,0,0,.20))' }} />
          <div style={{ position:'absolute', inset:'14% 14% 16% 14%', display:'grid', gridTemplateRows:'auto 1fr', textAlign:'center', color:'#EAEFF8' }}>
            <div>
              <div style={{ fontWeight:900, fontSize:16 }}>Parcels of Time</div>
              <div style={{ opacity:.9, fontSize:12 }}>Public Registry</div>
            </div>
            <div style={{ display:'grid', placeItems:'center' }}>
              <div style={{ fontWeight:800, fontSize:20 }}>{niceUTC(e.ts)}</div>
              <div style={{ opacity:.7, marginTop:8, fontSize:12 }}>ID</div>
              <div style={{ fontWeight:700, fontSize:14 }}>{idShort}</div>

              {e.title && (<>
                <div style={{ opacity:.7, marginTop:8, fontSize:12 }}>Title</div>
                <div style={{ fontWeight:800, fontSize:15 }}>{e.title}</div>
              </>)}

              {e.message && (<>
                <div style={{ opacity:.7, marginTop:8, fontSize:12 }}>Message</div>
                <div style={{ maxWidth:'78%', margin:'4px auto 0', fontSize:13, lineHeight:1.35 }}>“{e.message}”</div>
              </>)}
            </div>
          </div>

          {/* badges décoratifs */}
          <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:6, flexWrap:'wrap' }}>
            {badges.love && <span style={badgeStyle('#ff7aa6')}>❤️ Love</span>}
            {badges.win  && <span style={badgeStyle('#ffd166')}>🏆 Success</span>}
            {badges.joy  && <span style={badgeStyle('#8dd3ff')}>🎉 Joy</span>}
          </div>
        </div>
      </a>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', color:'var(--muted)', fontSize:12 }}>
          <button onClick={()=>copy(e.id)} style={miniBtn}>Copier ID</button>
          <button onClick={()=>copy(e.ts)} style={miniBtn}>Copier UTC</button>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href={href} style={miniBtn}>Ouvrir</a>
          <button onClick={share} style={miniBtn}>Partager</button>
        </div>
      </div>
    </article>
  )
}
const badgeStyle = (c:string): React.CSSProperties => ({
  border:'1px solid rgba(255,255,255,.18)',
  borderRadius:999, padding:'4px 8px', fontSize:11,
  color:'#0b0e14', background: c, boxShadow:'0 2px 10px rgba(0,0,0,.2)'
})
const miniBtn: React.CSSProperties = {
  border:'1px solid var(--border)', background:'transparent', color:'var(--text)',
  padding:'6px 8px', borderRadius:8, cursor:'pointer', textDecoration:'none'
}

/** -------------------------------------------
 * UI principale (client)
 * ------------------------------------------*/
export default function RegistryClient({
  initial, apiHref, locale, initialQuery,
}: {
  initial: RegistryPayload; apiHref: string; locale: string; initialQuery?: InitialQuery
}) {
  const [items, setItems] = useState<RegistryItem[]>(initial.items || [])
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor || null)
  const [loading, setLoading] = useState(false)

  // UI state
  const [q, setQ] = useState(initialQuery?.q || '')
  const [hasTitle, setHasTitle] = useState<boolean>(!!initialQuery?.hasTitle)
  const [hasMessage, setHasMessage] = useState<boolean>(!!initialQuery?.hasMessage)
  const [sort, setSort] = useState<'new'|'old'>(initialQuery?.sort || 'new')
  const [poem, setPoem] = useState(false)
  const [mode, setMode] = useState<'card'|'mosaic'>('card')

  const sentryRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  // agrégation palette → Aurora
  const swatches = useMemo(()=>{
    // récupère 2 couleurs dominantes de 8 items aléatoires
    const take = items.slice(0, 24)
    const cols: string[] = []
    for (const e of take) {
      const { palette } = artHashFor(e)
      cols.push(palette[1], palette[2])
    }
    return cols.slice(0, 8)
  }, [items])

  const queryString = useMemo(()=>{
    const p = new URLSearchParams({ limit:'24' })
    if (cursor) p.set('cursor', cursor)
    if (q) p.set('q', q)
    if (hasTitle) p.set('hasTitle','1')
    if (hasMessage) p.set('hasMessage','1')
    if (sort==='old') p.set('sort','old')
    return p.toString()
  }, [cursor, q, hasTitle, hasMessage, sort])

  const refetch = useCallback(async (reset=false) => {
    setLoading(true)
    try {
      const url = `${apiHref}?${reset ? queryString.replace(/(^|&)cursor=[^&]*/,'') : queryString}`
      const res = await fetch(url, { cache: 'no-store' })
      const ok = res.ok
      const j: RegistryPayload = ok ? await res.json() : { items: [], nextCursor: null }
      setItems(prev => reset ? (j.items || []) : [...prev, ...(j.items || [])])
      setCursor(j.nextCursor || null)
    } catch {
      // silence, pas de crash UI
    } finally {
      setLoading(false)
    }
  }, [apiHref, queryString])

  // refresh quand filtres changent
  useEffect(()=>{ setCursor(null); refetch(true) }, [q, hasTitle, hasMessage, sort]) // eslint-disable-line

  // infinite scroll
  useEffect(()=>{
    const el = sentryRef.current
    if (!el) return
    const io = new IntersectionObserver((entries)=>{
      const ent = entries[0]
      if (ent.isIntersecting && !loading && cursor) refetch()
    }, { rootMargin:'800px 0px' })
    io.observe(el); return ()=>io.disconnect()
  }, [cursor, loading, refetch])

  // clavier : / focus search, p poème, m mosaïque
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if (e.key==='/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); searchRef.current?.focus()
      }
      if (e.key==='p') setPoem(v=>!v)
      if (e.key==='m') setMode(m=>m==='card'?'mosaic':'card')
    }
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey)
  }, [])

  const poemText = useMemo(()=> items.map(e => (e.message || e.title || '').trim()).filter(Boolean).slice(0, 120), [items])

  return (
    <>
      {/* Aurora vivante agrégée */}
      <Aurora swatches={swatches} />

      {/* Barre d’actions (collante) */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:10, alignItems:'center',
        position:'sticky', top:0, zIndex:10,
        background:'color-mix(in srgb, var(--bg) 86%, transparent)',
        backdropFilter:'saturate(120%) blur(10px)',
        borderBottom:'1px solid var(--border)',
        padding:'10px 12px', margin:'-10px -12px 14px'
      }}>
        <input
          ref={searchRef}
          value={q} onChange={e=>setQ(e.target.value)}
          placeholder="Rechercher (titre, message, UTC, ID)… — tappez / pour focuser"
          aria-label="Rechercher"
          style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:12, background:'var(--surface)', color:'var(--text)' }}
        />
        <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <input type="checkbox" checked={hasTitle} onChange={e=>setHasTitle(e.target.checked)} />
          <span style={{ fontSize:13, color:'var(--muted)' }}>Avec titre</span>
        </label>
        <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <input type="checkbox" checked={hasMessage} onChange={e=>setHasMessage(e.target.checked)} />
          <span style={{ fontSize:13, color:'var(--muted)' }}>Avec message</span>
        </label>
        <select value={sort} onChange={e=>setSort(e.target.value as any)}
          aria-label="Tri"
          style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:10, background:'var(--surface)', color:'var(--text)' }}>
          <option value="new">Plus récents</option>
          <option value="old">Plus anciens</option>
        </select>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setPoem(p=>!p)} style={toolbarBtn} aria-pressed={poem}>{poem ? 'Stop poème' : 'Mode poème'}</button>
          <button onClick={()=>setMode(m=>m==='card'?'mosaic':'card')} style={toolbarBtn} aria-pressed={mode==='mosaic'}>
            {mode==='mosaic' ? 'Mode cartes' : 'Mode mosaïque'}
          </button>
        </div>
      </div>

      <PoemBanner poem={poem} setPoem={setPoem} lines={poemText} />

      {/* Grille responsive : mosaïque = cell plus grandes */}
      <div
        role="list"
        style={{
          display:'grid',
          gridTemplateColumns: mode==='mosaic' ? 'repeat(12, 1fr)' : 'repeat(12, 1fr)',
          gap:16,
        }}
      >
        {items.map((e)=>(
          <div
            role="listitem"
            key={`${e.id}-${e.ts}`}
            style={{ gridColumn: mode==='mosaic' ? 'span 6' : 'span 4' }}
          >
            <ArtCard e={e} locale={locale} mode={mode}/>
          </div>
        ))}
      </div>

      {/* Sentry & states */}
      <div ref={sentryRef} style={{ height:1 }} />
      {loading && <SkeletonGrid mode={mode} />}
      {!loading && items.length===0 && (
        <div style={{ textAlign:'center', opacity:.84, marginTop:24 }}>
          Aucune entrée publique pour l’instant.
        </div>
      )}
    </>
  )
}

const toolbarBtn: React.CSSProperties = {
  border:'1px solid var(--border)', background:'transparent', color:'var(--text)',
  padding:'10px 12px', borderRadius:10, cursor:'pointer'
}

/** -------------------------------------------
 * Poème (chœur des messages)
 * ------------------------------------------*/
function PoemBanner({ poem, setPoem, lines }:{ poem:boolean; setPoem:(v:boolean)=>void; lines:string[] }) {
  return (
    <div style={{
      border:'1px solid var(--border)', borderRadius:14, padding:12, margin:'6px 0 16px',
      background:'var(--surface)', display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:12
    }}>
      <div aria-live="polite" style={{ minHeight:22, color:'var(--text)', opacity:.92, fontStyle:'italic' }}>
        {poem ? <PoemCarousel lines={lines} /> : <span style={{opacity:.75}}>Activez le mode <strong>poème</strong> pour écouter le chœur des messages…</span>}
      </div>
      <button onClick={()=>setPoem(!poem)} style={{ border:'1px solid var(--border)', background:'transparent', color:'var(--text)', padding:'8px 10px', borderRadius:10, cursor:'pointer' }}>
        {poem ? 'Stop' : 'Mode poème'}
      </button>
    </div>
  )
}

function PoemCarousel({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0)
  useEffect(()=>{
    if (lines.length===0) return
    const t = setInterval(()=>setI(v=>(v+1)%lines.length), 2200)
    return ()=>clearInterval(t)
  }, [lines])
  if (lines.length===0) return null
  return <span>“{lines[i]}”</span>
}

/** -------------------------------------------
 * Skeleton
 * ------------------------------------------*/
function SkeletonGrid({ mode }:{ mode:'card'|'mosaic' }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16, marginTop:16 }}>
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{
          gridColumn: mode==='mosaic' ? 'span 6' : 'span 4',
          height: mode==='mosaic' ? 300 : 260,
          border:'1px solid var(--border)', borderRadius:16,
          background:'linear-gradient(90deg, rgba(255,255,255,.05), rgba(255,255,255,.03), rgba(255,255,255,.05))',
          animation:'shimmer 1.4s infinite'
        }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  )
}
