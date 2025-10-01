export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { locale: 'fr'|'en' } }) {
  const loc = params.locale === 'fr' ? 'fr' : 'en'
  return (
    <main style={{maxWidth:860, margin:'0 auto', padding:'32px 20px'}}>
      <h1>{loc==='fr' ? 'Mentions légales' : 'Legal Notice'}</h1>
      <p>{loc==='fr'
        ? 'Éditeur : Parcels of Time — contact : support@parcelsoftime.example'
        : 'Publisher: Parcels of Time — contact: support@parcelsoftime.example'}</p>
      <p>{loc==='fr'
        ? 'Hébergement : Vercel / Base de données : Supabase (UE). Paiements : Stripe.'
        : 'Hosting: Vercel / Database: Supabase (EU). Payments: Stripe.'}</p>
      <p>{loc==='fr'
        ? 'Responsable de la publication : … (renseigner la société/auto-entreprise et les identifiants légaux).'
        : 'Publication manager: … (fill your company/sole-prop and statutory identifiers).'}
      </p>
    </main>
  )
}
