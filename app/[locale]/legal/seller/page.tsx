export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { locale: 'fr'|'en' } }) {
  const fr = params.locale === 'fr'
  return (
    <main style={{maxWidth:860, margin:'0 auto', padding:'32px 20px'}}>
      <h1>{fr?'Conditions Vendeur (Marketplace)':'Seller Terms (Marketplace)'}</h1>
      <ul>
        <li>{fr?'KYC/KYB obligatoire via Stripe Connect.':'KYC/KYB required via Stripe Connect.'}</li>
        <li>{fr?'Commission 10% (min 1 €) sur le prix de vente.':'10% fee (min €1) on sale price.'}</li>
        <li>{fr?'Obligations fiscales et comptables à votre charge.':'You handle tax/accounting obligations.'}</li>
        <li>{fr?'Vous garantissez la licéité des contenus.':'You warrant the legality of your content.'}</li>
      </ul>
    </main>
  )
}
