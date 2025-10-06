export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'

type Params = { locale: 'fr'|'en' }
function t(locale:'fr'|'en'){
  return locale==='fr'
    ? {
        h1: 'Récupérer un cadeau',
        subtitle: 'Entrez l’ID du certificat, son SHA-256 et le code à 5 caractères.',
        fields: { claim_id:'ID du certificat', cert_hash:'SHA-256', code:'Code à 5 caractères' },
        cta: 'Valider le transfert',
        done: 'Transfert réussi. Redirection…',
        error: 'Erreur. Vérifiez vos informations ou réessayez.',
        needLogin: 'Connexion requise.',
      }
    : {
        h1: 'Recover a gift',
        subtitle: 'Enter the certificate ID, its SHA-256 and the 5-char code.',
        fields: { claim_id:'Certificate ID', cert_hash:'SHA-256', code:'5-char code' },
        cta: 'Confirm transfer',
        done: 'Transfer successful. Redirecting…',
        error: 'Error. Check your inputs or try again.',
        needLogin: 'Sign-in required.',
      }
}

export default async function Page({ params, searchParams }: {
  params: Promise<Params>,
  searchParams: Promise<Record<string,string|undefined>>
}) {
  const { locale } = await params
  const sp = await searchParams
  const sess = await readSession()
  if (!sess) redirect(`/${locale}/login?next=/${locale}/gift/recover${sp?.claim_id||sp?.cert_hash ? `?${new URLSearchParams(sp as any).toString()}`:''}`)

  const i18n = t(locale)
  const preClaim = sp?.claim_id || ''
  const preHash  = sp?.cert_hash || ''

  return (
    <main style={{minHeight:'100vh', background:'#0B0E14', color:'#E6EAF2', fontFamily:'Inter, system-ui'}}>
      <section style={{maxWidth:640, margin:'0 auto', padding:'32px 20px'}}>
        <a href={`/${locale}/account`} style={{textDecoration:'none', color:'#E6EAF2', opacity:.85}}>&larr; {locale==='fr'?'Mon compte':'My account'}</a>
        <h1 style={{fontFamily:'Fraunces, serif', fontSize:36, margin:'10px 0 6px'}}>{i18n.h1}</h1>
        <p style={{opacity:.8, marginTop:0}}>{i18n.subtitle}</p>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.currentTarget as HTMLFormElement
            const data = new FormData(form)
            try {
              const res = await fetch('/api/claim/transfer', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                  claim_id: String(data.get('claim_id')||'').trim(),
                  cert_hash: String(data.get('cert_hash')||'').trim(),
                  code: String(data.get('code')||'').trim().toUpperCase(),
                  locale: '${locale}',
                })
              })
              const json = await res.json()
              if (json?.ok) {
                (form.querySelector('[data-msg]') as HTMLElement).textContent = '${i18n.done}'
                window.location.href = json.account_url
              } else {
                (form.querySelector('[data-err]') as HTMLElement).textContent = json?.message || '${i18n.error}'
              }
            } catch {
              (form.querySelector('[data-err]') as HTMLElement).textContent = '${i18n.error}'
            }
          }}
          style={{display:'grid', gap:12, marginTop:10, background:'#111726', border:'1px solid #1E2A3C', borderRadius:12, padding:16}}
        >
          <label style={{display:'grid', gap:6}}>
            <span>{i18n.fields.claim_id}</span>
            <input name="claim_id" defaultValue={preClaim} required
              style={{padding:'12px 14px', border:'1px solid #1E2A3C', borderRadius:10, background:'rgba(255,255,255,.02)', color:'#E6EAF2'}} />
          </label>
          <label style={{display:'grid', gap:6}}>
            <span>{i18n.fields.cert_hash}</span>
            <input name="cert_hash" defaultValue={preHash} required
              style={{padding:'12px 14px', border:'1px solid #1E2A3C', borderRadius:10, background:'rgba(255,255,255,.02)', color:'#E6EAF2'}} />
          </label>
          <label style={{display:'grid', gap:6}}>
            <span>{i18n.fields.code}</span>
            <input name="code" required pattern="[A-Z0-9]{5}" placeholder="ABCDE"
              style={{padding:'12px 14px', border:'1px solid #1E2A3C', borderRadius:10, background:'rgba(255,255,255,.02)', color:'#E6EAF2', textTransform:'uppercase'}} />
          </label>

          <button
            style={{padding:'12px 16px', borderRadius:12, border:'1px solid #1E2A3C', background:'#E4B73D', color:'#0B0E14', fontWeight:800}}
          >
            {i18n.cta}
          </button>

          <div data-msg style={{fontSize:13, color:'#A7F3D0'}} />
          <div data-err style={{fontSize:13, color:'#FCA5A5'}} />
        </form>
      </section>
    </main>
  )
}
