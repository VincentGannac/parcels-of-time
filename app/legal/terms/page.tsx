export default function Page() {
  return (
    <main
      style={{
        fontFamily: 'Inter, system-ui',
        background: '#FAF9F7',
        color: '#0B0B0C',
        minHeight: '100vh',
        padding: 32,
      }}
    >
      <a href="/" style={{ textDecoration: 'none', color: '#0B0B0C', opacity: 0.8 }}>
        &larr; Parcels of Time
      </a>
      <h1 style={{ fontSize: 40, margin: '16px 0' }}>Conditions générales</h1>

      <p>
        En achetant une « Parcelle de temps », vous recevez la reconnaissance <strong>symbolique</strong> d’une
        seconde (UTC) via un certificat numérique et une page publique. Aucune propriété légale sur le temps n’est
        transférée.
      </p>
      <ul>
        <li><strong>Usage public :</strong> votre nom/message/lien peuvent apparaître publiquement sur la page de la seconde. Contenus illicites ou préjudiciables refusés/modérés.</li>
        <li><strong>Reventes :</strong> pourront être proposées via une place de marché ultérieure (frais & royalties communiqués le cas échéant).</li>
        <li><strong>Paiement :</strong> via Stripe. TVA collectée si applicable selon votre pays.</li>
        <li><strong>RGPD :</strong> données traitées pour exécuter la commande ; droit d’accès/suppression sur demande.</li>
      </ul>

      <p>Contact : <a href="mailto:support@parcelsoftime.com">support@parcelsoftime.com</a>.</p>
    </main>
  );
}
