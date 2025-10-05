// app/[locale]/reset/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { readSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

type Params = { locale: 'fr'|'en' }
type Search = { token?: string; err?: string }

const TOKENS = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-border': '#1E2A3C',
} as const

function t(locale:'fr'|'en') {
  const fr = {
    title:'Réinitialiser le mot de passe',
    pw:'Nouveau mot de passe',
    pw2:'Confirmer le mot de passe',
    cta:'Mettre à jour',
    bad:'Lien invalide ou expiré.',
    weak:'Mot de passe trop court (min. 8).',
    mismatch:'Les mots de passe ne correspondent pas.',
    show:'Afficher', hide:'Masquer'
  }
  const en = {
    title:'Reset password',
    pw:'New password',
    pw2:'Confirm password',
    cta:'Update password',
    bad:'Invalid or expired link.',
    weak:'Password too short (min. 8).',
    mismatch:'Passwords do not match.',
    show:'Show', hide:'Hide'
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
    <main
      style={{
        ['--color-bg' as any]: TOKENS['--color-bg'],
        ['--color-surface' as any]: TOKENS['--color-surface'],
        ['--color-text' as any]: TOKENS['--color-text'],
        ['--color-muted' as any]: TOKENS['--color-muted'],
        ['--color-primary' as any]: TOKENS['--color-primary'],
        ['--color-on-primary' as any]: TOKENS['--color-on-primary'],
        ['--color-border' as any]: TOKENS['--color-border'],
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui',
      }}
    >
      <section style={{maxWidth:560, margin:'0 auto', padding:'32px 20px'}}>
        <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
          <a href={`/${locale}`} style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; Parcels of Time</a>
        </header>

        <h1 style={{fontFamily:'Fraunces, serif', fontSize:36, margin:'0 0 12px'}}>{i18n.title}</h1>

        {err && (
          <div role="alert" style={{margin:'12px 0 16px', padding:'12px 14px', border:'1px solid #FEE2E2', background:'#FEF2F2', color:'#991B1B', borderRadius:12, fontSize:14}}>
            {map[err] || i18n.bad}
          </div>
        )}

        <section style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:12, padding:16 }}>
          <form method="POST" action="/api/auth/reset" style={{display:'grid', gap:12}}>
            <input type="hidden" name="locale" value={locale}/>
            <input type="hidden" name="token" value={token || ''}/>
            <label style={{display:'grid', gap:6}}>
              <span>{i18n.pw}</span>
              <div style={{ position:'relative' }}>
                <input name="password" type="password" required minLength={8}
                  placeholder="••••••••"
                  data-pw="1"
                  style={{padding:'12px 44px 12px 14px', border:'1px solid var(--color-border)', background:'rgba(255,255,255,.02)', color:'var(--color-text)', borderRadius:10, width:'100%'}} />
                <button type="button" data-toggle="1"
                  style={{position:'absolute', right:8, top:8, padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', cursor:'pointer'}}>
                  {i18n.show} 👁
                </button>
              </div>
            </label>
            <label style={{display:'grid', gap:6}}>
              <span>{i18n.pw2}</span>
              <div style={{ position:'relative' }}>
                <input name="password2" type="password" required minLength={8}
                  placeholder="••••••••"
                  data-pw="2"
                  style={{padding:'12px 44px 12px 14px', border:'1px solid var(--color-border)', background:'rgba(255,255,255,.02)', color:'var(--color-text)', borderRadius:10, width:'100%'}} />
                <button type="button" data-toggle="2"
                  style={{position:'absolute', right:8, top:8, padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', cursor:'pointer'}}>
                  {i18n.show} 👁
                </button>
              </div>
            </label>
            <button type="submit" style={{padding:'12px 16px', borderRadius:12, border:'1px solid var(--color-border)', background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800, cursor:'pointer'}}>
              {i18n.cta}
            </button>
          </form>
        </section>

        {/* Script progressif: bascule afficher/masquer mot de passe */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    function hook(n){
      var btn = document.querySelector('[data-toggle="'+n+'"]');
      var inp = document.querySelector('[data-pw="'+n+'"]');
      if(!btn || !inp) return;
      btn.addEventListener('click', function(){
        var showing = inp.getAttribute('type') === 'text';
        inp.setAttribute('type', showing ? 'password' : 'text');
        btn.innerText = (showing ? '${i18n.show} 👁' : '${i18n.hide} 🙈');
      });
    }
    hook('1'); hook('2');
  } catch(_) {}
})();`}}
        />
      </section>
    </main>
  )
}
