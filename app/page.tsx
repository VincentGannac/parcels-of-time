// app/page.tsx — Parcels of Time landing (copy-first, minimal styling)

import Link from 'next/link'

export default function Page() {
  return (
    <main style={{fontFamily:'Inter, system-ui, -apple-system, Segoe UI, Roboto', background:'#FAF9F7', color:'#0B0B0C'}}>
      <section style={{maxWidth:960, margin:'0 auto', padding:'96px 24px 56px'}}>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <img src="/logo.svg" alt="Parcels of Time" width={40} height={40} />
          <h1 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:32, margin:0}}>Parcels of Time</h1>
        </div>
        <h2 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:56, lineHeight:1.05, margin:'32px 0 12px'}}>
          Own a second, forever.
        </h2>
        <p style={{fontSize:20, maxWidth:680, opacity:.9}}>
          Claim the exclusive, symbolic ownership of a single second — past or future —
          recorded in a public registry and sealed by a signed certificate.
        </p>
        <div style={{marginTop:28, display:'flex', gap:12}}>
          <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:8, textDecoration:'none', fontWeight:600}}>
            Claim your second
          </Link>
          <a href="#how" style={{padding:'14px 18px', borderRadius:8, border:'1px solid #D9D7D3', textDecoration:'none', color:'#0B0B0C'}}>How it works</a>
        </div>
      </section>

      <section id="how" style={{maxWidth:960, margin:'0 auto', padding:'48px 24px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28}}>How it works</h3>
        <ol style={{fontSize:18, lineHeight:1.5}}>
          <li><strong>Choose</strong> an exact UTC timestamp (to the second).</li>
          <li><strong>Pay</strong> securely.</li>
          <li><strong>Receive</strong> your signed certificate and public page.</li>
        </ol>
      </section>

      <section id="editions" style={{maxWidth:960, margin:'0 auto', padding:'24px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28}}>Editions & pricing</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16}}>
          <div style={{border:'1px solid #D9D7D3', borderRadius:12, padding:16}}>
            <h4 style={{marginTop:0}}>Classic</h4>
            <p>Any free second.</p>
            <p><strong>€79</strong></p>
          </div>
          <div style={{border:'1px solid #D9D7D3', borderRadius:12, padding:16}}>
            <h4 style={{marginTop:0}}>Premium</h4>
            <p>Pattern seconds (11:11:11, palindromes, leap day).</p>
            <p><strong>€790</strong></p>
          </div>
          <div style={{border:'1px solid #D9D7D3', borderRadius:12, padding:16}}>
            <h4 style={{marginTop:0}}>Iconic</h4>
            <p>24h auctions for mythic timestamps.</p>
            <p><strong>Variable</strong></p>
          </div>
        </div>
      </section>

      <section id="faq" style={{maxWidth:960, margin:'0 auto', padding:'24px 24px 80px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28}}>FAQ</h3>
        <details style={{marginBottom:12}}>
          <summary>What do I own, exactly?</summary>
          <p>You own the exclusive symbolic claim to a specific second, recorded in our public registry, plus a signed certificate. This is not a financial instrument nor legal ownership of time.</p>
        </details>
        <details style={{marginBottom:12}}>
          <summary>Can I resell?</summary>
          <p>Yes, through our secondary market (with provenance and a 10% creator royalty).</p>
        </details>
        <details style={{marginBottom:12}}>
          <summary>Right of withdrawal?</summary>
          <p>Digital content delivered immediately: you agree to waive the EU right of withdrawal at checkout.</p>
        </details>
        <details style={{marginBottom:12}}>
          <summary>Moderation & safety?</summary>
          <p>Public messages/links are moderated. Illegal or harmful content is refused.</p>
        </details>
      </section>
    </main>
  );
}
