// Parcels of Time — Landing (conversion-first)
import Link from 'next/link'
import UTCClock from './components/UTCClock'

export default function Page() {
  return (
    <main style={{fontFamily:'Inter, system-ui, -apple-system, Segoe UI, Roboto', background:'#FAF9F7', color:'#0B0B0C'}}>
      {/* HERO */}
      <section style={{maxWidth:1040, margin:'0 auto', padding:'88px 24px 40px'}}>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <img src="/logo.svg" alt="Parcels of Time" width={40} height={40} />
          <h1 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:32, margin:0}}>Parcels of Time</h1>
        </div>

        <h2 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:64, lineHeight:1.05, margin:'28px 0 12px'}}>
          Own a second, forever.
        </h2>

        <p style={{fontSize:20, maxWidth:760, opacity:.92, margin:'0 0 18px'}}>
          Claim the <strong>exclusive, symbolic</strong> ownership of any single second in UTC — past or future.
          It’s recorded in a public registry and sealed with a <strong>signed certificate</strong> you can share or gift.
        </p>

        <div style={{marginTop:22, display:'flex', flexWrap:'wrap', gap:12}}>
          <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:8, textDecoration:'none', fontWeight:600}}>
            Claim your second
          </Link>
          <a href="#how" style={{padding:'14px 18px', borderRadius:8, border:'1px solid #D9D7D3', textDecoration:'none', color:'#0B0B0C'}}>How it works</a>
          <a href="#editions" style={{padding:'14px 18px', borderRadius:8, border:'1px solid #D9D7D3', textDecoration:'none', color:'#0B0B0C'}}>Editions & pricing</a>
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

      {/* CERTIFICATE PREVIEW */}
      <section aria-labelledby="preview" style={{maxWidth:1040, margin:'0 auto', padding:'12px 24px 8px'}}>
        <h3 id="preview" style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28, marginBottom:12}}>
          What you receive
        </h3>

        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16}}>
          {/* Grand aperçu type "Romantic" */}
          <div style={{border:'1px solid #D9D7D3', borderRadius:16, background:'#fff', padding:20}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
              <strong style={{fontSize:16}}>Parcels of Time — Certificate of Claim</strong>
              <span style={{fontSize:12, opacity:.6}}>PDF sample • Romantic</span>
            </div>

            <div style={{
              border:'1px dashed #E3E1DC', borderRadius:12, padding:16,
              background:'linear-gradient(135deg,#FFE6EE,#FFF)'}}
            >
              <div style={{fontSize:22, fontWeight:700, marginBottom:6}}>2017-06-24 21:13:07 UTC</div>
              <div style={{fontSize:12, opacity:.7, marginBottom:8}}>Owned by</div>
              <div style={{fontSize:15, fontWeight:600, marginBottom:12}}>A.&nbsp;L.</div>

              <div style={{fontSize:12, opacity:.7, marginBottom:6}}>Message</div>
              <blockquote style={{margin:0, fontSize:14, fontStyle:'italic'}}>
                “The exact second of our first kiss on the Pont des Arts.
                A warm June night, the city lights blinking like fireflies — time stood still.”
              </blockquote>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16}}>
                <div>
                  <div style={{fontSize:11, opacity:.6}}>Certificate ID</div>
                  <div style={{fontSize:12, fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    #2F9C-LOVE-24
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11, opacity:.6}}>Integrity (SHA-256)</div>
                  <div style={{fontSize:11, fontFamily:'monospace', opacity:.8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    a3f1…9b
                  </div>
                </div>
              </div>
            </div>

            <div style={{display:'flex', gap:12, marginTop:12, flexWrap:'wrap'}}>
              <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'10px 14px', borderRadius:8, textDecoration:'none', fontWeight:600}}>
                Get yours now
              </Link>
              <a href="#inspire" style={{padding:'10px 14px', borderRadius:8, border:'1px solid #D9D7D3', textDecoration:'none', color:'#0B0B0C'}}>
                See real inspirations
              </a>
            </div>
          </div>

          {/* Points de valeur */}
          <ul style={{margin:0, padding:0, listStyle:'none', display:'grid', gap:12, alignContent:'start'}}>
            <li style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Public page for your second
            </li>
            <li style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Signed, shareable PDF certificate (multiple styles)
            </li>
            <li style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Personal message & optional link (moderated)
            </li>
            <li style={{background:'#fff', border:'1px solid #D9D7D3', borderRadius:12, padding:14}}>
              ✅ Instant email delivery
            </li>
          </ul>
        </div>
      </section>


            {/* INSPIRATION GALLERY */}
      <section id="inspire" style={{maxWidth:1040, margin:'0 auto', padding:'20px 24px 8px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28, marginBottom:12}}>
          Inspiration gallery
        </h3>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16}}>
          {/* Love / Romantic */}
          <div style={{border:'1px solid #D9D7D3', borderRadius:14, background:'#fff', overflow:'hidden', display:'grid'}}>
            <div style={{height:110, background:'linear-gradient(135deg,#FFE6EE,#FFF)'}} />
            <div style={{padding:14, display:'grid', gap:8}}>
              <strong>Ode to love</strong>
              <p style={{margin:0, opacity:.9}}>
                “The second our paths crossed for real — a shaky laugh, a missed metro,
                and that kiss we still talk about.”
              </p>
              <p style={{margin:0, fontSize:12, opacity:.65}}>2017-06-24 21:13:07 UTC • Romantic style</p>
              <Link
                href={`/claim?ts=${encodeURIComponent('2017-06-24T21:13:07Z')}&style=romantic`}
                style={{textDecoration:'none', fontWeight:600}}
              >
                Claim a romantic second →
              </Link>
            </div>
          </div>

          {/* Birth */}
          <div style={{border:'1px solid #D9D7D3', borderRadius:14, background:'#fff', overflow:'hidden', display:'grid'}}>
            <div style={{height:110, background:'linear-gradient(135deg,#E0F2FE,#FDE68A,#FCE7F3)'}} />
            <div style={{padding:14, display:'grid', gap:8}}>
              <strong>Welcome to the world</strong>
              <p style={{margin:0, opacity:.9}}>
                “05:42:10 — Léa cried for the first time. We cried too.
                Tiny fingers wrapped around ours; everything else disappeared.”
              </p>
              <p style={{margin:0, fontSize:12, opacity:.65}}>2023-11-03 05:42:10 UTC • Birth style</p>
              <Link
                href={`/claim?ts=${encodeURIComponent('2023-11-03T05:42:10Z')}&style=birth`}
                style={{textDecoration:'none', fontWeight:600}}
              >
                Claim a birth second →
              </Link>
            </div>
          </div>

          {/* Proposal / Wedding */}
          <div style={{border:'1px solid #D9D7D3', borderRadius:14, background:'#fff', overflow:'hidden', display:'grid'}}>
            <div style={{height:110, background:'radial-gradient(circle at 30% 30%,#F7F3E9 0,#FFF 60%)'}} />
            <div style={{padding:14, display:'grid', gap:8}}>
              <strong>She said yes</strong>
              <p style={{margin:0, opacity:.9}}>
                “18:11:11 — the longest breath I ever took.
                Trembling hands, a ring that almost fell, and her yes.”
              </p>
              <p style={{margin:0, fontSize:12, opacity:.65}}>2021-09-12 18:11:11 UTC • Wedding style</p>
              <Link
                href={`/claim?ts=${encodeURIComponent('2021-09-12T18:11:11Z')}&style=wedding`}
                style={{textDecoration:'none', fontWeight:600}}
              >
                Claim a wedding second →
              </Link>
            </div>
          </div>
        </div>
      </section>



      {/* HOW IT WORKS */}
      <section id="how" style={{maxWidth:1040, margin:'0 auto', padding:'40px 24px 16px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28}}>How it works</h3>
        <ol style={{fontSize:18, lineHeight:1.6, margin:0, paddingLeft:20}}>
          <li>Choose an exact <strong>UTC</strong> timestamp (to the second). Tip: anniversaries, palindromes, 11:11:11…</li>
          <li>Pay securely with Stripe.</li>
          <li>Receive your signed PDF and your public page.</li>
        </ol>
      </section>

      {/* EDITIONS */}
      <section id="editions" style={{maxWidth:1040, margin:'0 auto', padding:'24px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28, marginBottom:12}}>Editions & pricing</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16}}>
          <div style={{border:'2px solid #0B0B0C', borderRadius:14, padding:18, background:'#fff'}}>
            <div style={{fontSize:12, fontWeight:700, letterSpacing:.3, opacity:.7, marginBottom:4}}>Most popular</div>
            <h4 style={{margin:'2px 0 6px', fontSize:18}}>Classic</h4>
            <p style={{margin:'0 0 8px'}}>Any free second.</p>
            <p style={{margin:'0 0 14px'}}><strong>€79</strong> one-time</p>
            <Link href="/claim" style={{textDecoration:'none', fontWeight:600}}>Claim Classic →</Link>
          </div>
          <div style={{border:'1px solid #D9D7D3', borderRadius:14, padding:18, background:'#fff'}}>
            <h4 style={{margin:'0 0 6px', fontSize:18}}>Premium</h4>
            <p style={{margin:'0 0 8px'}}>Pattern seconds (11:11:11, palindromes, leap day).</p>
            <p style={{margin:'0 0 14px'}}><strong>€790</strong></p>
            <Link href="/claim" style={{textDecoration:'none', fontWeight:600}}>Find a pattern →</Link>
          </div>
          <div style={{border:'1px solid #D9D7D3', borderRadius:14, padding:18, background:'#fff'}}>
            <h4 style={{margin:'0 0 6px', fontSize:18}}>Iconic</h4>
            <p style={{margin:'0 0 8px'}}>24h auctions for mythic timestamps.</p>
            <p style={{margin:'0 0 14px'}}><strong>Variable</strong></p>
            <a aria-disabled style={{opacity:.6, textDecoration:'none', cursor:'not-allowed'}}>Coming soon</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{maxWidth:1040, margin:'0 auto', padding:'16px 24px 72px'}}>
        <h3 style={{fontFamily:'Space Grotesk, Inter, system-ui', fontSize:28}}>FAQ</h3>

        <details style={{marginBottom:12}}>
          <summary>What do I own, exactly?</summary>
          <p>You own the <strong>symbolic</strong> claim to a specific second, recorded in our public registry, plus a signed certificate.
             This is not a financial instrument nor legal ownership of time.</p>
        </details>

        <details style={{marginBottom:12}}>
          <summary>Can I resell?</summary>
          <p>Yes, a secondary market is planned with provenance and a creator royalty (10%).</p>
        </details>

        <details style={{marginBottom:12}}>
          <summary>Right of withdrawal?</summary>
          <p>Instant digital delivery: you agree to waive the EU 14-day right of withdrawal at checkout.</p>
        </details>

        <details style={{marginBottom:12}}>
          <summary>Moderation & safety?</summary>
          <p>Public messages/links are moderated. Illegal or harmful content is refused.</p>
        </details>

        {/* Final CTA */}
        <div style={{marginTop:20}}>
          <Link href="/claim" style={{background:'#0B0B0C', color:'#FAF9F7', padding:'14px 18px', borderRadius:8, textDecoration:'none', fontWeight:600}}>
            Claim your second
          </Link>
        </div>
      </section>
    </main>
  )
}
