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
                    <div style={{height:56, borderRadius:8, border:'1px solid #E9E7E3',
                                 background:getStylePreviewBG(s.id)}} />
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

function getStylePreviewBG(style: CertStyle) {
  switch(style){
    case 'romantic':   return 'linear-gradient(135deg,#FFE6EE,#FFF8FB)'
    case 'birthday':   return 'repeating-linear-gradient(45deg,#FFF,#FFF 6px,#FDE68A 6px,#FDE68A 12px,#A7F3D0 12px,#A7F3D0 18px,#93C5FD 18px,#93C5FD 24px)'
    case 'wedding':    return 'radial-gradient(circle at 30% 30%,#F7F3E9 0,#FFF 60%)'
    case 'birth':      return 'linear-gradient(135deg,#E0F2FE,#FDE68A,#FCE7F3)'
    case 'christmas':  return 'linear-gradient(180deg,#F0FDF4,#FFF)'
    case 'newyear':    return 'radial-gradient(circle at 30% 30%,#E0E7FF 0,#FFF 60%)'
    case 'graduation': return 'linear-gradient(135deg,#F3F4F6,#FFF)'
    default:           return '#FFF'
  }
}
