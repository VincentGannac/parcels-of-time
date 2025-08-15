// app/page.tsx — Parcels of Time landing (polished UX)
import Link from 'next/link'
import UTCClock from './components/UTCClock'
import CertificateShowcase from './components/CertificateShowcase'

export default function Page() {
  return (
    <main style={{fontFamily:'Inter, system-ui, -apple-system, Segoe UI, Roboto', background:'#FAF9F7', color:'#0B0B0C'}}>
      {/* HERO */}
      <section
        style={{
          position:'relative',
          maxWidth:1040, margin:'0 auto', padding:'88px 24px 40px'
        }}
      >
        {/* subtle accent */}
        <div aria-hidden
          style={{
            position:'absolute', inset:0, top: -160, zIndex:-1,
            background:'radial-gradient(600px 220px at 20% 0%, rgba(11,11,12,.06), transparent), radial-gradient(400px 240px at 80% 0%, rgba(11,11,12,.05), transparent)'
          }}
        />
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <img src="/logo.svg" alt="Parcels of Time" width={40} height={40} />
          <h1 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:32, margin:0}}>Parcels of Time</h1>
        </div>

        <h2 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:64, lineHeight:1.05, margin:'28px 0 12px', letterSpacing:-0.5}}>
          Own a minute, forever.
        </h2>

        <p style={{fontSize:20, maxWidth:760, opacity:.92, margin:'0 0 18px'}}>
          Claim the <strong>exclusive, symbolic</strong> ownership of any single minute in UTC — past or future.
          It’s recorded in a public registry and sealed with a <strong>signed certificate</strong> you can share or gift.
        </p>

        <div style={{marginTop:22, display:'flex', flexWrap:'wrap', gap:12}}>
          <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:10, textDecoration:'none', fontWeight:700}}>
            Claim your minute
          </Link>
          <a href="#how" style={{padding:'14px 18px', borderRadius:10, border:'1px solid #D9D7D3', textDecoration:'none', color:'#0B0B0C'}}>How it works</a>
          <a href="#receive" style={{padding:'14px 18px', borderRadius:10, border:'1px solid #D9D7D3', textDecoration:'none', color:'#0B0B0C'}}>What you receive</a>
        </div>

        {/* Trust / reassurance */}
        <div style={{display:'flex', gap:16, flexWrap:'wrap', alignItems:'center', marginTop:18, fontSize:14, opacity:.8}}>
          <span>Powered by <strong>Stripe</strong></span>
          <span aria-hidden="true">•</span>
          <span>Signed PDF certificate</span>
          <span aria-hidden="true">•</span>
          <span>Public registry (UTC)</span>
        </div>

        {/* Legal banner */}
        <p style={{marginTop:8, fontSize:12, opacity:.65}}>
          Symbolic collectible — instant digital delivery. EU right of withdrawal is waived at checkout.
        </p>

        {/* Live UTC clock with deep-link to /claim */}
        <div style={{marginTop:24}}>
          <UTCClock />
        </div>
      </section>

      {/* WHAT YOU RECEIVE — with rotating real examples */}
      <section id="receive" aria-labelledby="preview" style={{maxWidth:1040, margin:'0 auto', padding:'24px'}}>
        <h3 id="preview" style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28, marginBottom:12}}>
          What you receive
        </h3>

        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16}}>
          {/* Showcase (auto-rotating, uses /public/cert_bg) */}
          <CertificateShowcase />

          {/* Value points */}
          <aside style={{display:'grid', gap:12, alignContent:'start'}}>
            <div style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Public page for your minute
            </div>
            <div style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Signed, shareable PDF certificate
              <div style={{fontSize:12, opacity:.7, marginTop:6}}>
                Choose a premium background style (Romantic, Birth, Wedding, Christmas, New Year, Graduation…)
              </div>
            </div>
            <div style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Personal message & optional link (moderated)
            </div>
            <div style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Instant email delivery
            </div>

            <div style={{marginTop:2}}>
              <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'12px 14px', borderRadius:10, textDecoration:'none', fontWeight:700}}>
                Claim your minute
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{maxWidth:1040, margin:'0 auto', padding:'16px 24px 72px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28}}>How it works</h3>
        <ol style={{fontSize:18, lineHeight:1.6, margin:0, paddingLeft:20}}>
          <li>Choose an exact <strong>UTC</strong> timestamp (to the minute). Tip: anniversaries, palindromes, 11:11:11…</li>
          <li>Pay securely with Stripe.</li>
          <li>Receive your signed PDF and your public page.</li>
        </ol>

        {/* Final CTA */}
        <div style={{marginTop:22}}>
          <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:10, textDecoration:'none', fontWeight:700}}>
            Claim your minute
          </Link>
        </div>
      </section>
    </main>
  )
}
