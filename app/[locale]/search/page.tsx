// app/search/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

function toIsoSecond(d: Date) {
  const copy = new Date(d)
  copy.setMilliseconds(0)
  return copy.toISOString()
}

function tryParseTs(input: string): string | null {
  if (!input) return null
  // supporte ISO direct ou datetime-local (sans Z)
  const s = input.trim()
  const maybe = new Date(s)
  if (isNaN(maybe.getTime())) return null
  return toIsoSecond(maybe)
}

// Quelques suggestions simples & mémorables
function suggestionsAround(baseISO: string): string[] {
  const base = new Date(baseISO)

  // 1) même jour à 11:11:11 UTC
  const s1 = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 11, 11, 11))

  // 2) minuit du même jour UTC
  const s2 = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0))

  // 3) fin de journée UTC
  const s3 = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59))

  // 4) prochain 29 fév. (leap day) 00:00:00 UTC
  const y = base.getUTCFullYear()
  const nextLeap = (() => {
    let year = y
    while (true) {
      year++
      const leap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
      if (leap) return year
    }
  })()
  const s4 = new Date(Date.UTC(nextLeap, 1, 29, 0, 0, 0))

  // 5) anniversaire (même mois/jour) à 12:34:56 UTC
  const s5 = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 34, 56))

  return [s1, s2, s3, s4, s5].map(toIsoSecond)
}

type Check = { ts: string; claimed: boolean | null; loading: boolean }

export default function Page() {
  const [raw, setRaw] = useState('') // champ libre (ISO ou datetime-local)
  const [iso, setIso] = useState<string | null>(null)
  const [result, setResult] = useState<Check | null>(null)
  const [sugg, setSugg] = useState<Check[]>([])

  // recalcul des suggestions dès qu'on a un ISO valide
  useEffect(() => {
    if (!iso) { setSugg([]); return }
    const list = suggestionsAround(iso).map(ts => ({ ts, claimed: null, loading: true }))
    setSugg(list)
    // check availability pour chaque
    list.forEach(async (item, idx) => {
      try {
        const res = await fetch(`/api/seconds/${encodeURIComponent(item.ts)}`, { cache: 'no-store' })
        const j = await res.json()
        setSugg(prev => {
          const copy = [...prev]
          copy[idx] = { ts: item.ts, claimed: !!j.claimed, loading: false }
          return copy
        })
      } catch {
        setSugg(prev => {
          const copy = [...prev]
          copy[idx] = { ts: item.ts, claimed: null, loading: false }
          return copy
        })
      }
    })
  }, [iso])

  const onCheck = async () => {
    const parsed = tryParseTs(raw)
    setIso(parsed)
    if (!parsed) { setResult({ ts: raw, claimed: null, loading: false }); return }
    setResult({ ts: parsed, claimed: null, loading: true })
    try {
      const res = await fetch(`/api/seconds/${encodeURIComponent(parsed)}`, { cache: 'no-store' })
      const j = await res.json()
      setResult({ ts: parsed, claimed: !!j.claimed, loading: false })
    } catch {
      setResult({ ts: parsed, claimed: null, loading: false })
    }
  }

  const claimHref = useMemo(() => iso ? `/claim?ts=${encodeURIComponent(iso)}` : '#', [iso])

  return (
    <main style={{fontFamily:'Inter, system-ui', background:'#FAF9F7', color:'#0B0B0C', minHeight:'100vh'}}>
      <section style={{maxWidth:900, margin:'0 auto', padding:'48px 24px'}}>
        <a href="/" style={{textDecoration:'none', color:'#0B0B0C', opacity:.8}}>&larr; Parcels of Time</a>
        <h1 style={{fontSize:40, margin:'16px 0'}}>Search a second</h1>
        <p style={{opacity:.8, marginTop:0}}>Paste an ISO timestamp (e.g. 2100-01-01T00:00:00Z) or pick below.</p>

        <div style={{display:'grid', gap:12, maxWidth:640, marginTop:12}}>
          <input
            placeholder="2100-01-01T00:00:00Z"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}
          />
          <div style={{display:'grid', gap:8}}>
            <span style={{opacity:.7, fontSize:12}}>Or pick local time:</span>
            <input
              type="datetime-local"
              onChange={e => setRaw(e.target.value)}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}
            />
          </div>
          <div style={{display:'flex', gap:10}}>
            <button onClick={onCheck}
              style={{background:'#0B0B0C', color:'#FAF9F7', padding:'10px 14px', borderRadius:8, fontWeight:600}}>
              Check availability
            </button>
            {iso && (
              <a href={claimHref}
                 style={{padding:'10px 14px', border:'1px solid #D9D7D3', borderRadius:8, textDecoration:'none', color:'#0B0B0C'}}>
                Claim this exact second
              </a>
            )}
          </div>
        </div>

        {/* Résultat principal */}
        {result && (
          <div style={{marginTop:24, border:'1px solid #E1DFDB', borderRadius:12, padding:16, background:'#fff', maxWidth:640}}>
            <div style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:18, marginBottom:8}}>
              {result.claimed === true && 'Taken'}
              {result.claimed === false && 'Available'}
              {result.claimed === null && (iso ? 'Unknown' : 'Invalid')}
            </div>
            <div style={{opacity:.8, fontFamily:'monospace'}}>
              {iso ? iso : (result.ts || '')}
            </div>
            {result.claimed === false && iso && (
              <div style={{marginTop:10}}>
                <a href={`/claim?ts=${encodeURIComponent(iso)}`}
                   style={{background:'#0B0B0C', color:'#FAF9F7', padding:'10px 14px', borderRadius:8, textDecoration:'none', fontWeight:600}}>
                  Claim now
                </a>
              </div>
            )}
            {result.claimed === true && iso && (
              <div style={{marginTop:10}}>
                <a href={`/s/${encodeURIComponent(iso)}`}
                   style={{padding:'10px 14px', border:'1px solid #D9D7D3', borderRadius:8, textDecoration:'none', color:'#0B0B0C'}}>
                  View owner page
                </a>
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {iso && (
          <section style={{marginTop:28}}>
            <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:24, marginBottom:8}}>Suggested pattern seconds</h3>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12}}>
              {sugg.map((s) => (
                <div key={s.ts} style={{border:'1px solid #E1DFDB', borderRadius:12, padding:14, background:'#fff'}}>
                  <div style={{fontFamily:'monospace'}}>{s.ts}</div>
                  <div style={{opacity:.7, fontSize:12, margin:'6px 0'}}>
                    {s.loading ? 'Checking…' : s.claimed ? 'Taken' : 'Available'}
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    {!s.loading && s.claimed === false && (
                      <a href={`/claim?ts=${encodeURIComponent(s.ts)}`}
                         style={{background:'#0B0B0C', color:'#FAF9F7', padding:'8px 10px', borderRadius:8, textDecoration:'none', fontWeight:600}}>
                        Claim
                      </a>
                    )}
                    {!s.loading && s.claimed === true && (
                      <a href={`/s/${encodeURIComponent(s.ts)}`}
                         style={{padding:'8px 10px', border:'1px solid #D9D7D3', borderRadius:8, textDecoration:'none', color:'#0B0B0C'}}>
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
