// app/legal/refund/page.tsx
/**
 * Politique de remboursement / rétractation (FR)
 * Cohérente avec la mention déjà affichée lors du paiement pour un contenu numérique livré immédiatement.
 */
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
  const UPDATED = '2025-01-01'

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
        background:'var(--color-bg)', color:'var(--color-text)', minHeight:'100vh', fontFamily:'Inter, system-ui'
      }}
    >
      <section style={{maxWidth:980, margin:'0 auto', padding:'48px 24px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
          <a href="/" style={{textDecoration:'none', color:'var(--color-text)', opacity:.85}}>&larr; {COMPANY_NAME}</a>
          <span style={{fontSize:12, color:'var(--color-muted)'}}>Mise à jour : {UPDATED}</span>
        </div>

        <header style={{marginBottom:12}}>
          <h1 style={{fontFamily:'Fraunces, serif', fontSize:40, margin:'0 0 8px'}}>Remboursements & droit de rétractation</h1>
          <p style={{margin:0, opacity:.85}}>Règles applicables aux certificats numériques.</p>
        </header>

        <div style={{display:'grid', gap:14}}>
          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <h2 style={{margin:'0 0 6px', fontSize:20}}>Contenu numérique et exécution immédiate</h2>
            <p style={{margin:'0 0 8px'}}>
              Les certificats vendus sont des <strong>contenus numériques fournis immédiatement</strong> (génération du PDF et lien de téléchargement dès le paiement).
              En procédant au paiement, vous consentez à l’exécution immédiate et <strong>renoncez expressément à votre droit de rétractation</strong> (directive UE).
            </p>
            <p style={{margin:0, fontSize:13, color:'var(--color-muted)'}}>
              Cette information est rappelée au moment du paiement.
            </p>
          </section>

          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <h2 style={{margin:'0 0 6px', fontSize:20}}>Erreurs de facturation & doublons</h2>
            <p style={{margin:0}}>
              En cas de <strong>paiement en double</strong>, d’erreur manifeste ou de problème technique empêchant la
              livraison du certificat, contactez-nous à <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:'var(--color-text)'}}>{SUPPORT_EMAIL}</a>.
              Nous investiguerons et procéderons, le cas échéant, à un remboursement partiel ou total.
            </p>
          </section>

          <section style={{background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:16}}>
            <h2 style={{margin:'0 0 6px', fontSize:20}}>Marketplace</h2>
            <p style={{margin:0}}>
              Les reventes entre utilisateurs sont traitées via un paiement sécurisé. Une <strong>commission</strong> est
              prélevée lors de la transaction réussie. Les certificats ne sont ni retournables ni échangeables.
            </p>
          </section>

          <footer style={{marginTop:8, fontSize:13, color:'var(--color-muted)'}}>
            Besoin d’aide ? <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:'var(--color-text)'}}>{SUPPORT_EMAIL}</a>
          </footer>
        </div>
      </section>
    </main>
  )
}
