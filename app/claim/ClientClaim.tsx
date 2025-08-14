'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

type CertStyle =
  | 'neutral'
  | 'romantic'
  | 'birthday'
  | 'wedding'
  | 'birth'
  | 'christmas'
  | 'newyear'
  | 'graduation'

const STYLES: { id: CertStyle; label: string; hint?: string }[] = [
  { id: 'neutral',    label: 'Neutral' },
  { id: 'romantic',   label: 'Romantic',  hint: 'soft pink confetti' },
  { id: 'birthday',   label: 'Birthday',  hint: 'color confetti' },
  { id: 'wedding',    label: 'Wedding',   hint: 'intertwined rings' },
  { id: 'birth',      label: 'Birth',     hint: 'pastel dots' },
  { id: 'christmas',  label: 'Christmas', hint: 'snow pattern' },
  { id: 'newyear',    label: 'New Year',  hint: 'fireworks rings' },
  { id: 'graduation', label: 'Graduation',hint: 'laurel & confetti' },
]

function safeDecode(value: string): string {
  let out = value
  try {
    for (let i = 0; i < 3; i++) {
      const dec = decodeURIComponent(out)
      if (dec === out) break
      out = dec
    }
  } catch {}
  return out
}

export default function ClientClaim() {
  const params = useSearchParams()
  const prefillRaw = params.get('ts') || ''
  const prefillTs = prefillRaw ? safeDecode(prefillRaw) : ''
  const styleParam = (params.get('style') || '').toLowerCase();
  const allowed = ['neutral','romantic','birthday','wedding','birth','christmas','newyear','graduation'];
  const initialStyle = allowed.includes(styleParam) ? (styleParam as any) : 'neutral';

  const [form, setForm] = useState({
    email: '',
    display_name: '',
    message: '',
    link_url: '',
    ts: prefillTs,
    cert_style: initialStyle as any,
  })
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')

    let tsInput = safeDecode((form.ts || '').trim())
    const d = new Date(tsInput)
    if (isNaN(d.getTime())) {
      setStatus('error')
      setError('Please provide a valid timestamp (ISO like 2100-01-01T00:00:00Z).')
      return
    }
    d.setMilliseconds(0)
    const tsISO = d.toISOString()

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ts: tsISO,
        email: form.email,
        display_name: form.display_name || undefined,
        message: form.message || undefined,
        link_url: form.link_url || undefined,
        cert_style: form.cert_style || 'neutral', // 👈 NEW
      }),
    })

    if (!res.ok) {
      setStatus('error')
      let msg = 'Unknown error'
      try {
        const j = await res.json()
        if (j.error === 'rate_limited') msg = 'Trop de tentatives. Réessaye dans ~1 minute.'
        else if (j.error === 'invalid_ts') msg = 'Timestamp invalide. Utilise un ISO comme 2100-01-01T00:00:00Z.'
        else if (j.error === 'missing_fields') msg = 'Renseigne au minimum l’email et le timestamp.'
        else msg = j.error || msg
      } catch {}
      setError(msg)
      return
    }

    const data = await res.json()
    window.location.href = data.url
  }

  return (
    <main style={{fontFamily:'Inter, system-ui', background:'#FAF9F7', color:'#0B0B0C', minHeight:'100vh'}}>
      <section style={{maxWidth:720, margin:'0 auto', padding:'64px 24px'}}>
        <a href="/" style={{textDecoration:'none', color:'#0B0B0C', opacity:.8}}>&larr; Parcels of Time</a>
        <h1 style={{fontSize:40, margin:'16px 0'}}>Claim your second</h1>

        <form onSubmit={onSubmit} style={{display:'grid', gap:12, marginTop:12}}>
          <label style={{display:'grid', gap:6}}>
            <span>Email (required)</span>
            <input required type="email" value={form.email}
              onChange={e=>setForm(f=>({...f, email:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Display name (public)</span>
            <input type="text" value={form.display_name}
              onChange={e=>setForm(f=>({...f, display_name:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Timestamp (UTC). ISO like 2100-01-01T00:00:00Z, or paste your link:</span>
            <input placeholder="2100-01-01T00:00:00Z" type="text" value={form.ts}
              onChange={e=>setForm(f=>({...f, ts:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
            <span style={{opacity:.7, fontSize:12}}>Or pick local time:</span>
            <input type="datetime-local"
              onChange={e=>setForm(f=>({...f, ts:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Message (optional)</span>
            <textarea value={form.message}
              onChange={e=>setForm(f=>({...f, message:e.target.value}))}
              rows={3} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Link URL (optional)</span>
            <input type="url" value={form.link_url}
              onChange={e=>setForm(f=>({...f, link_url:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          {/* 👇 CERTIFICATE STYLE PICKER */}
          <fieldset style={{border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
            <legend style={{padding:'0 6px'}}>Certificate style</legend>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10}}>
              {STYLES.map(s => {
                const selected = form.cert_style === s.id
                return (
                  <label key={s.id}
                    style={{
                      cursor:'pointer',
                      border:selected ? '2px solid #0B0B0C' : '1px solid #D9D7D3',
                      borderRadius:10,
                      background:'#fff',
                      padding:12,
                      display:'grid',
                      gap:6
                    }}>
                    <input
                      type="radio"
                      name="cert_style"
                      value={s.id}
                      checked={selected}
                      onChange={()=>setForm(f=>({...f, cert_style:s.id}))}
                      style={{display:'none'}}
                    />
                    <div style={{
                      height:56, borderRadius:8, border:'1px solid #E9E7E3',
                      ...getStylePreviewStyle(s.id)
                    }}/>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <span style={{fontWeight:600}}>{s.label}</span>
                      <span aria-hidden="true" style={{width:8, height:8, borderRadius:99,
                        background:selected ? '#0B0B0C' : '#D9D7D3'}} />
                    </div>
                    {s.hint && <span style={{opacity:.6, fontSize:12}}>{s.hint}</span>}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <button disabled={status==='loading'} type="submit"
            style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:8, fontWeight:600}}>
            {status==='loading' ? 'Redirecting…' : 'Pay & claim this second'}
          </button>

          {status==='error' && error && <p style={{color:'crimson'}}>{error}</p>}
        </form>
      </section>
    </main>
  )
}

function getStylePreviewStyle(style: CertStyle): React.CSSProperties {
  // Helpers
  const enc = (s: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`

  // Motifs SVG simples et lisibles en 56px
  const svgHeart = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <path d='M14 22s-6-4.8-9-8.1C3 12 3.6 8.5 6.7 7.3c2-.8 4.4-.1 5.7 1.6 1.3-1.7 3.7-2.4 5.7-1.6 3.1 1.2 3.7 4.7 1.7 6.7C20 17.2 14 22 14 22z'
      fill='#F06' fill-opacity='.35'/></svg>`

  const svgBalloon = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <ellipse cx='9' cy='9' rx='6' ry='7' fill='#93C5FD' fill-opacity='.65'/>
    <ellipse cx='19' cy='11' rx='6' ry='7' fill='#A7F3D0' fill-opacity='.65'/>
    <path d='M9 16 l2 3' stroke='#777' stroke-width='1'/>
    <path d='M19 18 l-2 4' stroke='#777' stroke-width='1'/>
  </svg>`

  const svgRings = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <circle cx='11' cy='14' r='7' fill='none' stroke='#C7A53A' stroke-width='2.6' opacity='.8'/>
    <circle cx='17' cy='12' r='7' fill='none' stroke='#C7A53A' stroke-width='2.6' opacity='.8'/>
  </svg>`

  const svgFoot = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <ellipse cx='9' cy='16' rx='4' ry='6' fill='#BDBDBD' fill-opacity='.45'/>
    <circle cx='6' cy='22' r='1.7' fill='#BDBDBD' fill-opacity='.45'/>
    <circle cx='8' cy='23' r='1.6' fill='#BDBDBD' fill-opacity='.45'/>
    <circle cx='10' cy='23' r='1.5' fill='#BDBDBD' fill-opacity='.45'/>
    <circle cx='12' cy='22' r='1.4' fill='#BDBDBD' fill-opacity='.45'/>
  </svg>`

  const svgSnow = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <g stroke='#CFE7FF' stroke-width='1.2' opacity='.85'>
      <line x1='14' y1='6' x2='14' y2='22'/><line x1='6' y1='14' x2='22' y2='14'/>
      <line x1='8' y1='8' x2='20' y2='20'/><line x1='20' y1='8' x2='8' y2='20'/>
    </g>
    <circle cx='14' cy='14' r='1.5' fill='#CFE7FF' opacity='.85'/>
  </svg>`

  const svgFireworks = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <g opacity='.9'>
      <g stroke='#8EA2FF' stroke-width='1.6'>
        <line x1='14' y1='6' x2='14' y2='12'/><line x1='14' y1='22' x2='14' y2='16'/>
        <line x1='6' y1='14' x2='12' y2='14'/><line x1='22' y1='14' x2='16' y2='14'/>
      </g>
      <g stroke='#FFD58A' stroke-width='1.6'>
        <line x1='8' y1='8' x2='11' y2='11'/><line x1='20' y1='20' x2='17' y2='17'/>
        <line x1='20' y1='8' x2='17' y2='11'/><line x1='8' y1='20' x2='11' y2='17'/>
      </g>
    </g>
  </svg>`

  const svgLaurel = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <ellipse cx='6' cy='20' rx='3' ry='6' fill='#D9D9D9' opacity='.8' transform='rotate(-30 6 20)'/>
    <ellipse cx='12' cy='21' rx='3' ry='6' fill='#D9D9D9' opacity='.8' transform='rotate(-10 12 21)'/>
    <ellipse cx='18' cy='21' rx='3' ry='6' fill='#D9D9D9' opacity='.8' transform='rotate(10 18 21)'/>
    <ellipse cx='24' cy='20' rx='3' ry='6' fill='#D9D9D9' opacity='.8' transform='rotate(30 24 20)'/>
  </svg>`

  switch (style) {
    case 'romantic':
      return { backgroundImage: enc(svgHeart), backgroundRepeat: 'repeat', backgroundSize: '28px 28px', backgroundColor:'#FFF' }
    case 'birthday':
      return { backgroundImage: enc(svgBalloon), backgroundRepeat: 'repeat', backgroundSize: '28px 28px', backgroundColor:'#FFF' }
    case 'wedding':
      return { backgroundImage: enc(svgRings), backgroundRepeat: 'repeat', backgroundSize: '28px 28px', backgroundColor:'#FFF' }
    case 'birth':
      return { backgroundImage: enc(svgFoot), backgroundRepeat: 'repeat', backgroundSize: '28px 28px', backgroundColor:'#FFF' }
    case 'christmas':
      return { backgroundImage: enc(svgSnow), backgroundRepeat: 'repeat', backgroundSize: '28px 28px', backgroundColor:'#FFF' }
    case 'newyear':
      return { backgroundImage: enc(svgFireworks), backgroundRepeat: 'repeat', backgroundSize: '28px 28px', backgroundColor:'#FFF' }
    case 'graduation':
      return { backgroundImage: enc(svgLaurel), backgroundRepeat: 'repeat', backgroundSize: '28px 28px', backgroundColor:'#FFF' }
    default:
      return { backgroundColor:'#FFF' }
  }
}

