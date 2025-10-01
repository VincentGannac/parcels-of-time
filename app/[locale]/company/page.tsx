// app/company/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const preferredRegion = ['cdg1', 'fra1']

const TOKENS = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-border': '#1E2A3C',
  '--shadow-elev1': '0 6px 20px rgba(0,0,0,.35)',
} as const

export default function Page() {
  const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Parcels of Time'
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com'
  const PRESS_EMAIL = process.env.NEXT_PUBLIC_PRESS_EMAIL || SUPPORT_EMAIL
  const UPDATED = '2025-01-01' // ⬅︎ modifiez si besoin

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
        ['--shadow-elev1' as any]: TOKENS['--shadow-elev1'],
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui',
      }}
    >
      <section style={{maxWidth: 980, margin: '0 auto', padding: '48px 24px'}}>
        {/* Top */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 18}}>
          <a href="/" style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; {COMPANY_NAME}</a>
          <span style={{fontSize:12, color:'var(--color-muted)'}}>Mise à jour&nbsp;: {UPDATED}</span>
        </div>

        <header style={{marginBottom: 14}}>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize: 44, lineHeight: '52px', margin:'0 0 8px'}}>
            À propos
          </h1>
          <p style={{opacity:.9, margin:0, maxWidth:760}}>
            {COMPANY_NAME} conçoit une manière simple et élégante de <strong>revendiquer une journée</strong> qui compte et d’en conserver la trace sous la forme d’un certificat signé (PDF/QR).
          </p>
        </header>

        <div style={{display:'grid', gridTemplateColumns:'1fr', gap:16}}>
          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <h2 style={{margin:'0 0 8px', fontSize:22}}>Mission</h2>
            <p style={{margin:0, opacity:.92}}>
              Nous aidons chacun·e à <strong>célébrer les instants fondateurs</strong> (naissance, rencontre, réussite…)
              en leur donnant une forme pérenne, partageable et vérifiable. Les certificats sont <em>signés</em> et
              consultables via un QR code — l’art de figer une émotion dans le temps.
            </p>
          </section>

          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <h2 style={{margin:'0 0 8px', fontSize:22}}>Ce que nous construisons</h2>
            <ul style={{margin:'0 0 0 18px', lineHeight:1.7}}>
              <li>Un flux d’achat simple (Stripe), livraison immédiate du certificat.</li>
              <li>Une <strong>page dédiée</strong> pour chaque journée, avec message/lien modérables.</li>
              <li>Un <strong>registre public</strong> optionnel pour exposer des œuvres choisies.</li>
              <li>Une <strong>marketplace</strong> sécurisée pour la revente des certificats.</li>
            </ul>
          </section>

          <section style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <h2 style={{margin:'0 0 8px', fontSize:22}}>Presse & partenariats</h2>
              <p style={{margin:'0 0 10px', opacity:.92}}>
                Dossiers, visuels produits, captures d’écran haute définition et FAQ sont disponibles sur demande.
              </p>
              <a href={`mailto:${PRESS_EMAIL}`}
                 style={{textDecoration:'none', background:'var(--color-primary)', color:'var(--color-on-primary)', padding:'10px 12px', borderRadius:10, fontWeight:800}}>
                Contacter la presse
              </a>
            </div>
            <div style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
              <h2 style={{margin:'0 0 8px', fontSize:22}}>Support</h2>
              <p style={{margin:'0 0 10px', opacity:.92}}>
                Une question, un souci de paiement, une demande de rectification&nbsp;? Nous répondons rapidement.
              </p>
              <a href={`mailto:${SUPPORT_EMAIL}`}
                 style={{textDecoration:'none', background:'transparent', color:'var(--color-text)', border:'1px solid var(--color-border)', padding:'10px 12px', borderRadius:10}}>
                {SUPPORT_EMAIL}
              </a>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
