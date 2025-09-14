'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const sp = useSearchParams()
  const next = sp.get('next') || '/fr/account'
  const locale = /^\/fr\b/.test(next) ? 'fr' : 'en'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email, next, locale }),
    })
    if (res.ok) setSent(true)
    else setErr('Impossible d’envoyer le lien. Réessayez.')
  }

  return (
    <main style={{maxWidth:480, margin:'0 auto', padding:'48px 20px', fontFamily:'Inter, system-ui'}}>
      <Link href={`/${locale}`} style={{textDecoration:'none'}}>&larr; Parcels of Time</Link>
      <h1 style={{fontSize:28, margin:'12px 0 8px'}}>Connexion</h1>
      {sent ? (
        <p>Vérifiez votre boîte mail. Le lien expire dans 30&nbsp;minutes.</p>
      ) : (
        <form onSubmit={submit} style={{display:'grid', gap:12}}>
          <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                 placeholder="vous@exemple.com"
                 style={{padding:'12px 14px', border:'1px solid #ddd', borderRadius:10}}/>
          <button type="submit" style={{padding:'12px 14px', borderRadius:10, background:'#0B0B0C', color:'#fff', fontWeight:700}}>
            Recevoir le lien de connexion
          </button>
          {err && <div style={{color:'#c00', fontSize:13}}>{err}</div>}
        </form>
      )}
    </main>
  )
}
