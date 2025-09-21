// app/[locale]/reset/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { readSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

type Params = { locale: 'fr'|'en' }
type Search = { token?: string; err?: string }

function t(locale:'fr'|'en') {
  const fr = {
    title:'Réinitialiser le mot de passe',
    pw:'Nouveau mot de passe',
    pw2:'Confirmer le mot de passe',
    cta:'Mettre à jour',
    bad:'Lien invalide ou expiré.',
    weak:'Mot de passe trop court (min. 8).',
    mismatch:'Les mots de passe ne correspondent pas.',
  }
  const en = {
    title:'Reset password',
    pw:'New password',
    pw2:'Confirm password',
    cta:'Update password',
    bad:'Invalid or expired link.',
    weak:'Password too short (min. 8).',
    mismatch:'Passwords do not match.',
  }
  return locale==='fr'?fr:en
}

export default async function Page({ params, searchParams }: { params: Promise<Params>, searchParams: Promise<Search> }) {
  const { locale } = await params
  const { token, err } = await searchParams
  const i18n = t(locale)

  // Si déjà connecté → /account
  const sess = await readSession().catch(()=>null)
  if (sess) redirect(`/${locale}/account`)

  const map: Record<string,string> = { bad_token:i18n.bad, weak_password:i18n.weak, mismatch:i18n.mismatch }

  return (
    <main style={{maxWidth:520, margin:'0 auto', padding:'36px 20px', fontFamily:'Inter, system-ui'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
        <a href={`/${locale}`} style={{textDecoration:'none', opacity:.85}}>&larr; Parcels of Time</a>
      </header>

      <h1 style={{fontFamily:'Fraunces, serif', fontSize:34, margin:'0 0 12px'}}>{i18n.title}</h1>

      {err && (
        <div role="alert" style={{margin:'12px 0 16px', padding:'12px 14px', border:'1px solid #FEE2E2', background:'#FEF2F2', color:'#991B1B', borderRadius:12, fontSize:14}}>
          {map[err] || i18n.bad}
        </div>
      )}

      <form method="POST" action="/api/auth/reset" style={{display:'grid', gap:12}}>
        <input type="hidden" name="locale" value={locale}/>
        <input type="hidden" name="token" value={token || ''}/>
        <label style={{display:'grid', gap:6}}>
          <span>{i18n.pw}</span>
          <input name="password" type="password" required minLength={8}
            style={{padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:10}} />
        </label>
        <label style={{display:'grid', gap:6}}>
          <span>{i18n.pw2}</span>
          <input name="password2" type="password" required minLength={8}
            style={{padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:10}} />
        </label>
        <button type="submit" style={{padding:'12px 16px', borderRadius:12, border:'none', background:'#111827', color:'white', fontWeight:800, cursor:'pointer'}}>
          {i18n.cta}
        </button>
      </form>
    </main>
  )
}
