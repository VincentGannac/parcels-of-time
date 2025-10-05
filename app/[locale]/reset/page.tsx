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
    show:'Afficher', hide:'Masquer',
    pwStrengthTitle:'Sécurité du mot de passe',
    tip:'Astuce : combinez lettres, chiffres et symboles.',
    caps:'Verr. Maj activé',
    labels: {
      veryWeak:'Très faible',
      weak:'Faible',
      fair:'Moyen',
      good:'Bon',
      veryGood:'Très bon',
      excellent:'Excellent',
    },
  }
  const en = {
    title:'Reset password',
    pw:'New password',
    pw2:'Confirm password',
    cta:'Update password',
    bad:'Invalid or expired link.',
    weak:'Password too short (min. 8).',
    mismatch:'Passwords do not match.',
    show:'Show', hide:'Hide',
    pwStrengthTitle:'Password strength',
    tip:'Tip: mix letters, numbers & symbols.',
    caps:'Caps Lock enabled',
    labels: {
      veryWeak:'Very weak',
      weak:'Weak',
      fair:'Fair',
      good:'Good',
      veryGood:'Very good',
      excellent:'Excellent',
    },
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

            {/* PW 1 */}
            <label style={{display:'grid', gap:6}}>
              <span>{i18n.pw}</span>
              <div style={{ position:'relative' }}>
                <input name="password" type="password" required minLength={8}
                  placeholder="••••••••"
                  data-pw="1"
                  aria-invalid="false"
                  style={{padding:'12px 44px 12px 14px', border:'1px solid var(--color-border)', background:'rgba(255,255,255,.02)', color:'var(--color-text)', borderRadius:10, width:'100%'}} />
                <button type="button" data-toggle="1"
                  style={{position:'absolute', right:8, top:8, padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', cursor:'pointer'}}>
                  {i18n.show} 👁
                </button>
              </div>

              {/* Strength block (hidden until typing) */}
              <div data-strength-block style={{ display:'none', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12 }}>
                  <span>{i18n.pwStrengthTitle}</span>
                  <strong data-strength-label aria-live="polite">{i18n.labels.veryWeak}</strong>
                </div>
                <div aria-hidden="true" style={{ height:8, background:'rgba(255,255,255,.06)', border:'1px solid var(--color-border)', borderRadius:999, overflow:'hidden' }}>
                  <div data-strength-bar style={{ width:'0%', height:'100%', background:'var(--color-primary)' }} />
                </div>
              </div>

              {/* Caps Lock hint */}
              <div data-caps="1" style={{ display:'none', fontSize:12, color:'#ffdf8a' }}>⇪ {i18n.caps}</div>

              {/* Tip */}
              <span style={{ fontSize:12, opacity:.8 }}>{i18n.tip}</span>
            </label>

            {/* PW 2 */}
            <label style={{display:'grid', gap:6}}>
              <span>{i18n.pw2}</span>
              <div style={{ position:'relative' }}>
                <input name="password2" type="password" required minLength={8}
                  placeholder="••••••••"
                  data-pw="2"
                  aria-invalid="false"
                  style={{padding:'12px 44px 12px 14px', border:'1px solid var(--color-border)', background:'rgba(255,255,255,.02)', color:'var(--color-text)', borderRadius:10, width:'100%'}} />
                <button type="button" data-toggle="2"
                  style={{position:'absolute', right:8, top:8, padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text)', cursor:'pointer'}}>
                  {i18n.show} 👁
                </button>
              </div>

              {/* Live mismatch + caps */}
              <div data-mismatch style={{ display:'none', fontSize:12, color:'#ffb2b2' }} role="status" aria-live="polite">
                {i18n.mismatch}
              </div>
              <div data-caps="2" style={{ display:'none', fontSize:12, color:'#ffdf8a' }}>⇪ {i18n.caps}</div>
            </label>

            <button type="submit" style={{padding:'12px 16px', borderRadius:12, border:'1px solid var(--color-border)', background:'var(--color-primary)', color:'var(--color-on-primary)', fontWeight:800, cursor:'pointer'}}>
              {i18n.cta}
            </button>
          </form>
        </section>

        {/* Script progressif: bascule afficher/masquer + force + conseils + vérifs */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var SHOW_TXT = ${JSON.stringify(i18n.show + ' 👁')};
    var HIDE_TXT = ${JSON.stringify(i18n.hide + ' 🙈')};
    var LABELS = ${JSON.stringify([
      i18n.labels.veryWeak,
      i18n.labels.weak,
      i18n.labels.fair,
      i18n.labels.good,
      i18n.labels.veryGood,
      i18n.labels.excellent,
    ])};

    function $(sel){ return document.querySelector(sel); }

    function hookToggle(n){
      var btn = $('[data-toggle="'+n+'"]');
      var inp = $('[data-pw="'+n+'"]');
      if(!btn || !inp) return;
      btn.addEventListener('click', function(){
        var showing = inp.getAttribute('type') === 'text';
        inp.setAttribute('type', showing ? 'password' : 'text');
        btn.textContent = showing ? SHOW_TXT : HIDE_TXT;
      });
    }

    // Strength scoring 0..4 (same logic as signup)
    function score(pw){
      if(!pw) return 0;
      var s = 0;
      if(pw.length >= 8) s++;
      if(pw.length >= 12) s++;
      if(/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
      if(/\\d/.test(pw)) s++;
      if(/[^A-Za-z0-9]/.test(pw)) s++;
      s = Math.min(4, Math.max(0, s - 1));
      return s;
    }

    var pw1 = $('[data-pw="1"]');
    var pw2 = $('[data-pw="2"]');
    var strengthBlock = $('[data-strength-block]');
    var strengthBar = $('[data-strength-bar]');
    var strengthLabel = $('[data-strength-label]');
    var mismatch = $('[data-mismatch]');
    var caps1 = $('[data-caps="1"]');
    var caps2 = $('[data-caps="2"]');

    function updateStrength(){
      var v = pw1 ? pw1.value : '';
      if(!strengthBlock || !strengthBar || !strengthLabel) return;
      if(!v){ strengthBlock.style.display = 'none'; return; }
      strengthBlock.style.display = 'grid';
      var sc = score(v);
      var pct = (sc / 4) * 100;
      strengthBar.style.width = pct + '%';
      strengthLabel.textContent = LABELS[sc+1] || LABELS[0];
    }

    function updateMismatch(){
      if(!pw1 || !pw2 || !mismatch) return;
      if(pw2.value && pw1.value !== pw2.value){
        mismatch.style.display = 'block';
        pw2.setAttribute('aria-invalid','true');
      } else {
        mismatch.style.display = 'none';
        pw2.setAttribute('aria-invalid','false');
      }
    }

    function hookCaps(inp, el){
      if(!inp || !el) return;
      function setCaps(e){
        try {
          var on = e.getModifierState && e.getModifierState('CapsLock');
          el.style.display = on ? 'block' : 'none';
        } catch(_) { /* no-op */ }
      }
      inp.addEventListener('keyup', setCaps);
      inp.addEventListener('focus', function(e){ setCaps(e); });
      inp.addEventListener('blur', function(){ el.style.display = 'none'; });
    }

    // Submit guard (progressive)
    var form = document.querySelector('form[action="/api/auth/reset"]');
    if(form){
      form.addEventListener('submit', function(e){
        if(!pw1 || !pw2) return;
        if((pw1.value||'').length < 8){
          e.preventDefault();
          strengthBlock && (strengthBlock.style.display = 'grid');
          pw1.focus();
          return;
        }
        if(pw1.value !== pw2.value){
          e.preventDefault();
          mismatch && (mismatch.style.display = 'block');
          pw2.focus();
        }
      });
    }

    // Hooks
    hookToggle('1'); hookToggle('2');
    if(pw1){ pw1.addEventListener('input', function(){ updateStrength(); updateMismatch(); }); }
    if(pw2){ pw2.addEventListener('input', updateMismatch); }

    hookCaps(pw1, caps1);
    hookCaps(pw2, caps2);

    // Initial paint (in case of autofill)
    updateStrength();
    updateMismatch();
  } catch(_) {}
})();`}}
        />
      </section>
    </main>
  )
}
