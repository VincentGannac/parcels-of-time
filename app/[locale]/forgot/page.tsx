// app/[locale]/forgot/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { readSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

type Params = { locale: 'fr'|'en' }
type Search = { sent?: string }

function t(locale:'fr'|'en') {
  const fr = { title:'Mot de passe oublié', back:'Retour', email:'Votre e-mail', cta:'Envoyer le lien', sent:'Si un compte existe, un e-mail a été envoyé.' }
  const en = { title:'Forgot password', back:'Back', email:'Your email', cta:'Send reset link', sent:'If an account exists, we sent you an email.' }
  return locale==='fr'?fr:en
}

export default async function Page({ params, searchParams }: { params: Promise<Params>, searchParams: Promise<Search> }) {
  const { locale } = await params
  const { sent } = await searchParams
  const i18n = t(locale)

  const sess = await readSession().catch(()=>null)
  if (sess) redirect(`/${locale}/account`)

  return (
    <main style={{maxWidth:520, margin:'0 auto', padding:'36px 20px', fontFamily:'Inter, system-ui'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
        <a href={`/${locale}`} style={{textDecoration:'none', opacity:.85}}>&larr; {i18n.back}</a>
      </header>

      <h1 style={{fontFamily:'Fraunces, serif', fontSize:34, margin:'0 0 12px'}}>{i18n.title}</h1>

      {sent === '1' ? (
        <div style={{border:'1px solid #d1fae5', background:'#ecfdf5', color:'#065f46', padding:12, borderRadius:12}}>
          {i18n.sent}
        </div>
      ) : (
        <form method="POST" action="/api/auth/forgot" style={{display:'grid', gap:12}}>
          <input type="hidden" name="locale" value={locale}/>
          <label style={{display:'grid', gap:6}}>
            <span>{i18n.email}</span>
            <input name="email" type="email" required autoComplete="email"
              style={{padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:10}} />
          </label>
          <button type="submit" style={{padding:'12px 16px', borderRadius:12, border:'none', background:'#111827', color:'white', fontWeight:800, cursor:'pointer'}}>
            {i18n.cta}
          </button>
        </form>
      )}
    </main>
  )
}
