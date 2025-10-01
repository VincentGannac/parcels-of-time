export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { locale: 'fr'|'en' } }) {
  const fr = params.locale === 'fr'
  return (
    <main style={{maxWidth:860, margin:'0 auto', padding:'32px 20px'}}>
      <h1>{fr?'Politique des cookies':'Cookie Policy'}</h1>
      <ul>
        <li>{fr?'Essentiels (sécurité, session, paiement Stripe) — toujours actifs.':'Essential (security, session, Stripe payment) — always on.'}</li>
        <li>{fr?'Mesure d’audience agrégée — activée si consentie.':'Aggregate analytics — enabled if consented.'}</li>
        <li>{fr?'Vous pouvez modifier votre choix depuis votre navigateur ou en supprimant le consentement local.':'You may update your choice via your browser or by removing local consent.'}</li>
      </ul>
    </main>
  )
}
