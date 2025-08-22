// app/[locale]/explore/RegistryClient.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type RegistryItem = { id: string; ts: string; title?: string|null; message?: string|null }
type RegistryPayload = { items: RegistryItem[]; nextCursor?: string|null }

function niceUTC(iso: string) {
  return iso.replace('T',' ').replace(':00.000Z',' UTC').replace('Z',' UTC')
}

function EntryCard({ e, locale }: { e: RegistryItem; locale: string }) {
  const href = `/${locale}/m/${encodeURIComponent(e.ts)}`
  const subtle = 'rgba(26,31,42,.72)'
  const tone = 'rgba(26,31,42,.92)'
  const idShort = e.id.length > 20 ? e.id.slice(0, 8) + '…' + e.id.slice(-4) : e.id

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text) } catch {} }
  const share = async () => {
    const url = location.origin + href
    try {
      if (navigator.share) await navigator.share({ title:'Parcels of Time — Registre public', text: e.title || e.message || niceUTC(e.ts), url })
      else await navigator.clipboard.writeText(url)
    } catch {}
  }

  return (
    <article style={{
      display:'grid', gridTemplateRows:'auto 1fr auto',
      background:'var(--color-surface)', border:'1px solid var(--color-border)',
      borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-elev1)'
    }}>
      <a href={href} aria-label="Voir la minute" style={{ textDecoration:'none', color:'inherit' }}>
        <div style={{ position:'relative', width:'100%', aspectRatio:'595/842', background:'#F4F1EC' }}>
          <div aria-hidden style={{
            position:'absolute', inset:0, background:
              'radial-gradient(30% 18% at 20% -8%, rgba(228,183,61,.14), transparent 60%), radial-gradient(28% 20% at 90% -6%, rgba(140,214,255,.14), transparent 60%)'
          }} />
          <div style={{ position:'absolute', inset:'16% 16% 18% 16%', display:'grid', gridTemplateRows:'auto 1fr', textAlign:'center', color:tone }}>
            <div>
              <div style={{ fontWeight:900, fontSize:16 }}>Parcels of Time</div>
              <div style={{ opacity:.9, fontSize:12 }}>Public Registry</div>
            </div>
            <div style={{ display:'grid', placeItems:'center' }}>
              <div style={{ fontWeight:800, fontSize:20 }}>{niceUTC(e.ts)}</div>
              <div style={{ opacity:.7, marginTop:8, fontSize:12 }}>ID</div>
              <div style={{ fontWeight:700, fontSize:14 }}>{idShort}</div>
              {e.title && (<><div style={{ opacity:.7, marginTop:8, fontSize:12 }}>Title</div><div style={{ fontWeight:800, fontSize:15 }}>{e.title}</div></>)}
              {e.message && (<><div style={{ opacity:.7, marginTop:8, fontSize:12 }}>Message</div><div style={{ maxWidth:'78%', margin:'4px auto 0', fontSize:13, lineHeight:1.35 }}>“{e.message}”</div></>)}
            </div>
          </div>
          <div aria-hidden style={{ position:'absolute', right:12, bottom:12, width:82, height:82, border:'1px dashed rgba(26,31,42,.45)', borderRadius:8, display:'grid', placeItems:'center', fontSize:12, color:subtle }}>QR</div>
        </div>
      </a>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderTop:'1px solid var(--color-border)' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', color:'var(--color-muted)', fontSize:12 }}>
          <button onClick={()=>copy(e.id)} style={{ border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'6px 8px', borderRadius:8, cursor:'pointer' }}>Copier ID</button>
          <button onClick={()=>copy(e.ts)} style={{ border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'6px 8px', borderRadius:8, cursor:'pointer' }}>Copier UTC</button>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href={href} style={{ textDecoration:'none', border:'1px solid var(--color-border)', padding:'6px 8px', borderRadius:8, color:'var(--color-text)' }}>Ouvrir</a>
          <button onClick={share} style={{ border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'6px 8px', borderRadius:8, cursor:'pointer' }}>Partager</button>
        </div>
      </div>
    </article>
  )
}

export default function RegistryClient({ initial, apiHref, locale }: { initial: RegistryPayload; apiHref: string; locale: string }) {
  const [items, setItems] = useState<RegistryItem[]>(initial.items || [])
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor || null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState(''); const [hasTitle, setHasTitle] = useState(false); const [hasMessage, setHasMessage] = useState(false)
  const [sort, setSort] = useState<'new'|'old'>('new'); const [poem, setPoem] = useState(false)
  const sentryRef = useRef<HTMLDivElement | null>(null)

  const poemText = useMemo(()=> items.map(e => (e.message || e.title || '').trim()).filter(Boolean).slice(0, 80), [items])

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
      // Si l’API renvoie 500, on n’échoue pas le rendu
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

  useEffect(()=>{ setCursor(null); refetch(true) }, [q, hasTitle, hasMessage, sort]) // eslint-disable-line

  useEffect(()=>{
    const el = sentryRef.current
    if (!el) return
    const io = new IntersectionObserver((entries)=>{
      const ent = entries[0]
      if (ent.isIntersecting && !loading && cursor) refetch()
    }, { rootMargin:'800px 0px' })
    io.observe(el); return ()=>io.disconnect()
  }, [cursor, loading, refetch])

  return (
    <>
      <div style={{
        display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:10, alignItems:'center',
        position:'sticky', top:0, zIndex:10,
        background:'color-mix(in srgb, var(--color-bg) 86%, transparent)',
        backdropFilter:'saturate(120%) blur(10px)',
        borderBottom:'1px solid var(--color-border)',
        padding:'10px 12px', margin:'-10px -12px 14px'
      }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher (titre, message, UTC, ID)…"
               style={{ padding:'12px 14px', border:'1px solid var(--color-border)', borderRadius:12, background:'var(--color-surface)', color:'var(--color-text)' }} />
        <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <input type="checkbox" checked={hasTitle} onChange={e=>setHasTitle(e.target.checked)} />
          <span style={{ fontSize:13, color:'var(--color-muted)' }}>Avec titre</span>
        </label>
        <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <input type="checkbox" checked={hasMessage} onChange={e=>setHasMessage(e.target.checked)} />
          <span style={{ fontSize:13, color:'var(--color-muted)' }}>Avec message</span>
        </label>
        <select value={sort} onChange={e=>setSort(e.target.value as any)}
                style={{ padding:'10px 12px', border:'1px solid var(--color-border)', borderRadius:10, background:'var(--color-surface)', color:'var(--color-text)' }}>
          <option value="new">Plus récents</option>
          <option value="old">Plus anciens</option>
        </select>
      </div>

      <PoemBanner poem={poem} setPoem={setPoem} lines={poemText} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:16 }}>
        {items.map((e)=>(
          <div key={`${e.id}-${e.ts}`} style={{ gridColumn:'span 4' }}>
            <EntryCard e={e} locale={locale} />
          </div>
        ))}
      </div>

      <div ref={sentryRef} style={{ height:1 }} />
      {loading && <SkeletonGrid />}
      {!loading && items.length===0 && <div style={{ textAlign:'center', opacity:.8, marginTop:24 }}>Aucune entrée publique pour l’instant.</div>}
    </>
  )
}

function PoemBanner({ poem, setPoem, lines }:{ poem:boolean; setPoem:(v:boolean)=>void; lines:string[] }) {
  return (
    <div style={{
      border:'1px solid var(--color-border)', borderRadius:14, padding:12, margin:'6px 0 16px',
      background:'var(--color-surface)', display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:12
    }}>
      <div aria-live="polite" style={{ minHeight:22, color:'var(--color-text)', opacity:.92, fontStyle:'italic' }}>
        {poem ? <PoemCarousel lines={lines} /> : <span style={{opacity:.75}}>Activez le mode <strong>poème</strong> pour écouter le chœur des messages…</span>}
      </div>
      <button onClick={()=>setPoem(!poem)} style={{ border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', padding:'8px 10px', borderRadius:10, cursor:'pointer' }}>
        {poem ? 'Stop' : 'Mode poème'}
      </button>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16, marginTop:16 }}>
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{ gridColumn:'span 4', height:260, border:'1px solid var(--color-border)', borderRadius:16, background:'linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.02), rgba(255,255,255,.04))', animation:'shimmer 1.4s infinite' }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
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
