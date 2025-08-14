// app/claim/ClientClaim.tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

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

  const [form, setForm] = useState({
    email: '',
    display_name: '',
    message: '',
    link_url: '',
    ts: prefillTs,
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
      }),
    })

    if (!res.ok) {
      setStatus('error')
      try { const j = await res.json(); setError(j.error || 'Unknown error') }
      catch { setError('Unknown error') }
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
