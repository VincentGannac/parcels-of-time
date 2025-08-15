'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

type CertStyle = 'neutral'|'romantic'|'birthday'|'wedding'|'birth'|'christmas'|'newyear'|'graduation'
const STYLES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'birth', label: 'Birth' },
  { id: 'christmas', label: 'Christmas' },
  { id: 'newyear', label: 'New Year' },
  { id: 'graduation', label: 'Graduation' },
] as const

function safeDecode(value: string): string {
  let out = value
  try { for (let i=0;i<3;i++){ const dec=decodeURIComponent(out); if(dec===out) break; out=dec } } catch {}
  return out
}

export default function ClientClaim() {
  const params = useSearchParams()
  const prefillRaw = params.get('ts') || ''
  const prefillTs = prefillRaw ? safeDecode(prefillRaw) : ''
  const styleParam = (params.get('style') || '').toLowerCase()
  const allowed = STYLES.map(s => s.id)
  const initialStyle = (allowed as readonly string[]).includes(styleParam) ? (styleParam as CertStyle) : 'neutral'

  const [form, setForm] = useState({
    email: '',
    display_name: '',
    message: '',
    link_url: '',
    ts: prefillTs,
    cert_style: initialStyle as CertStyle,
  })
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle')
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')

    const d = new Date(safeDecode((form.ts || '').trim()))
    if (isNaN(d.getTime())) {
      setStatus('error'); setError('Please provide a valid minute (ISO like 2100-01-01T00:00Z).'); return
    }
    d.setUTCSeconds(0,0) // minute
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
        cert_style: form.cert_style || 'neutral',
      }),
    })

    if (!res.ok) {
      setStatus('error')
      let msg = 'Unknown error'
      try {
        const j = await res.json()
        if (j.error === 'rate_limited') msg = 'Trop de tentatives. Réessaye dans ~1 minute.'
        else if (j.error === 'invalid_ts') msg = 'Timestamp invalide. Utilise un ISO comme 2100-01-01T00:00Z.'
        else if (j.error === 'missing_fields') msg = 'Renseigne au minimum l’email et l’horodatage à la minute.'
        else msg = j.error || msg
      } catch {}
      setError(msg); return
    }

    const data = await res.json()
    window.location.href = data.url
  }

  return (
    <main style={{fontFamily:'Inter, system-ui', background:'#FAF9F7', color:'#0B0B0C', minHeight:'100vh'}}>
      <section style={{maxWidth:720, margin:'0 auto', padding:'64px 24px'}}>
        <a href="/" style={{textDecoration:'none', color:'#0B0B0C', opacity:.8}}>&larr; Parcels of Time</a>
        <h1 style={{fontSize:40, margin:'16px 0'}}>Claim your minute</h1>

        <form onSubmit={onSubmit} style={{display:'grid', gap:12, marginTop:12}}>
          <label style={{display:'grid', gap:6}}>
            <span>Email (required)</span>
            <input required type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Display name (public)</span>
            <input type="text" value={form.display_name} onChange={e=>setForm(f=>({...f, display_name:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Timestamp (UTC). ISO like <code>2100-01-01T00:00Z</code>, or paste your link:</span>
            <input placeholder="2100-01-01T00:00Z" type="text" value={form.ts}
              onChange={e=>setForm(f=>({...f, ts:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
            <span style={{opacity:.7, fontSize:12}}>Or pick local time:</span>
            <input type="datetime-local" step={60}
              onChange={e=>setForm(f=>({...f, ts:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Message (optional)</span>
            <textarea value={form.message} onChange={e=>setForm(f=>({...f, message:e.target.value}))}
              rows={3} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <label style={{display:'grid', gap:6}}>
            <span>Link URL (optional)</span>
            <input type="url" value={form.link_url} onChange={e=>setForm(f=>({...f, link_url:e.target.value}))}
              style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>

          <fieldset style={{border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
            <legend style={{padding:'0 6px'}}>Certificate style</legend>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
              {STYLES.map(s => {
                const selected = form.cert_style === s.id
                const thumb = `/cert_bg/${s.id}_thumb.jpg`
                const full = `/cert_bg/${s.id}.png`
                return (
                  <label key={s.id} style={{cursor:'pointer', border:selected ? '2px solid #0B0B0C' : '1px solid #E4E2DE',
                    borderRadius:16, background:'#fff', padding:12, display:'grid', gap:8,
                    boxShadow: selected ? '0 0 0 3px rgba(11,11,12,.08) inset' : undefined}}>
                    <input type="radio" name="cert_style" value={s.id} checked={selected}
                      onChange={()=>setForm(f=>({...f, cert_style:s.id}))} style={{display:'none'}}/>
                    <div style={{height:96, borderRadius:12, border:'1px solid #E9E7E3',
                      backgroundImage:`url(${thumb}), url(${full})`,
                      backgroundSize:'cover', backgroundPosition:'center', backgroundColor:'#F8F7F5'}} />
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div><div style={{fontWeight:700}}>{s.label}</div></div>
                      <span aria-hidden="true" style={{width:8, height:8, borderRadius:99, background:selected ? '#0B0B0C' : '#D9D7D3'}} />
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <button disabled={status==='loading'} type="submit"
            style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:8, fontWeight:600}}>
            {status==='loading' ? 'Redirecting…' : 'Pay & claim this minute'}
          </button>
          {status==='error' && error && <p style={{color:'crimson'}}>{error}</p>}
        </form>
      </section>
    </main>
  )
}
