// app/[locale]/login/page.tsx
'use client'
export const runtime = 'nodejs'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function LoginPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const next = sp.get('next') || '/'
  const [email, setEmail] = useState(sp.get('email') || '')
  const [code, setCode] = useState(sp.get('code') || '')
  const [step, setStep] = useState<'request'|'verify'>(code ? 'verify' : 'request')
  const [msg, setMsg] = useState<string>('')

  useEffect(()=>{
    if (code && email) onVerify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onRequest() {
    setMsg('Envoi…')
    const res = await fetch('/api/auth/request', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) })
    if (!res.ok) { setMsg('Adresse invalide ?'); return }
    setStep('verify'); setMsg('Code envoyé par e-mail. Consultez votre boîte.')
  }

  async function onVerify() {
    setMsg('Vérification…')
    const res = await fetch('/api/auth/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, code }) })
    if (!res.ok) { setMsg('Code invalide ou expiré.'); return }
    setMsg('Connecté ✓'); router.replace(next)
  }

  return (
    <main style={{minHeight:'100vh', display:'grid', placeItems:'center', background:'#0B0E14', color:'#E6EAF2', fontFamily:'Inter, system-ui'}}>
      <div style={{width:420, maxWidth:'90vw', background:'#111726', border:'1px solid #1E2A3C', borderRadius:16, padding:18}}>
        <h1 style={{margin:'0 0 8px', fontFamily:'Fraunces, serif'}}>Se connecter</h1>
        {step === 'request' ? (
          <>
            <label style={{display:'grid', gap:6}}>
              <span>Votre e-mail</span>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                style={{padding:'12px 14px', border:'1px solid #1E2A3C', borderRadius:10, background:'transparent', color:'#E6EAF2'}} />
            </label>
            <button onClick={onRequest}
              style={{marginTop:12, background:'#E4B73D', color:'#0B0E14', padding:'12px 16px', border:'none', borderRadius:12, fontWeight:800}}>
              Recevoir un code
            </button>
          </>
        ) : (
          <>
            <div style={{fontSize:13, opacity:.8, marginBottom:8}}>Code envoyé à <strong>{email}</strong></div>
            <label style={{display:'grid', gap:6}}>
              <span>Code</span>
              <input inputMode="numeric" pattern="[0-9]*" value={code} onChange={e=>setCode(e.target.value)}
                placeholder="123456"
                style={{padding:'12px 14px', border:'1px solid #1E2A3C', borderRadius:10, background:'transparent', color:'#E6EAF2'}} />
            </label>
            <button onClick={onVerify}
              style={{marginTop:12, background:'#E4B73D', color:'#0B0E14', padding:'12px 16px', border:'none', borderRadius:12, fontWeight:800}}>
              Se connecter
            </button>
            <button onClick={()=>setStep('request')} style={{marginTop:10, background:'transparent', color:'#E6EAF2', border:'1px solid #1E2A3C', borderRadius:10, padding:'10px 12px'}}>
              Changer d’e-mail
            </button>
          </>
        )}
        {msg && <p style={{marginTop:10, fontSize:12, opacity:.8}}>{msg}</p>}
      </div>
    </main>
  )
}
