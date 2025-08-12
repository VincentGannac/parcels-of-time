'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function toSecondISO(dtLocal: string) {
  if (!dtLocal) return ''
  const hasSeconds = dtLocal.length > 16
  const s = hasSeconds ? dtLocal : dtLocal + ':00'
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  d.setMilliseconds(0)
  return d.toISOString()
}

export default function Page() {
  const router = useRouter()
  const params = useSearchParams()
  const prefillTs = params.get('ts') || ''
  const [form, setForm] = useState({ email:'', display_name:'', message:'', link_url:'', ts: prefillTs })
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'error'|'conflict'>('idle')
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')
    let tsISO = form.ts
    if (form.ts && (!form.ts.includes('T') || form.ts.length <= 19)) tsISO = toSecondISO(form.ts)
    if (!tsISO) { setStatus('error'); setError('Please provide a valid timestamp.'); return }

    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ts: tsISO, email: form.email, display_name: form.display_name || undefined, message: form.message || undefined, link_url: form.link_url || undefined })
    })
    if (res.ok) {
      const data = await res.json()
      setStatus('ok'); router.push(`/s/${encodeURIComponent(data.ts)}`); return
    }
    if (res.status === 409) { setStatus('conflict'); setError('This second is already claimed. Try another.'); return }
    setStatus('error'); try { const d = await res.json(); setError(d.error || 'Unknown error') } catch { setError('Unknown error') }
  }

  return (
    <main style={{fontFamily:'Inter, system-ui', background:'#FAF9F7', color:'#0B0B0C', minHeight:'100vh'}}>
      <section style={{maxWidth:720, margin:'0 auto', padding:'64px 24px'}}>
        <a href="/" style={{textDecoration:'none', color:'#0B0B0C', opacity:.8}}>&larr; Parcels of Time</a>
        <h1 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:40, margin:'16px 0'}}>Claim your second (Phase A)</h1>
        <p style={{opacity:.8}}>This MVP lets you claim a second for free to test the flow. Payment comes in Phase B.</p>
        <form onSubmit={onSubmit} style={{display:'grid', gap:12, marginTop:12}}>
          <label style={{display:'grid', gap:6}}>
            <span>Email (required)</span>
            <input required type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>
          <label style={{display:'grid', gap:6}}>
            <span>Display name (public)</span>
            <input type="text" value={form.display_name} onChange={e=>setForm(f=>({...f, display_name:e.target.value}))} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>
          <label style={{display:'grid', gap:6}}>
            <span>Timestamp (UTC). ISO like 2100-01-01T00:00:00Z, or pick local:</span>
            <input placeholder="2100-01-01T00:00:00Z" type="text" value={form.ts} onChange={e=>setForm(f=>({...f, ts:e.target.value}))} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
            <span style={{opacity:.7, fontSize:12}}>Or pick local time:</span>
            <input type="datetime-local" onChange={e=>setForm(f=>({...f, ts:e.target.value}))} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>
          <label style={{display:'grid', gap:6}}>
            <span>Message (optional)</span>
            <textarea value={form.message} onChange={e=>setForm(f=>({...f, message:e.target.value}))} rows={3} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>
          <label style={{display:'grid', gap:6}}>
            <span>Link URL (optional)</span>
            <input type="url" value={form.link_url} onChange={e=>setForm(f=>({...f, link_url:e.target.value}))} style={{padding:'12px 14px', border:'1px solid #D9D7D3', borderRadius:8}}/>
          </label>
          <button disabled={status==='loading'} type="submit" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:8, fontWeight:600}}>
            {status==='loading' ? 'Claiming…' : 'Claim this second'}
          </button>
          {status!=='idle' && error && <p style={{color:'crimson'}}>{error}</p>}
        </form>
      </section>
    </main>
  )
}
