//app/legal/mentions-legales/page.tsx
export default function Page() {
  return (
    <main style={{ fontFamily:'Inter, system-ui', background:'#FAF9F7', color:'#0B0B0C', minHeight:'100vh', padding:32 }}>
      <a href="/" style={{ textDecoration:'none', color:'#0B0B0C', opacity:0.8 }}>&larr; Parcels of Time</a>
      <h1 style={{ fontSize:40, margin:'16px 0' }}>Confidentialité</h1>
      <p>Nous collectons les données nécessaires à l’achat et à l’affichage de votre seconde : e-mail, nom public, message, lien, horodatage acheté, métadonnées de paiement (via Stripe).</p>
      <ul>
        <li><strong>Finalités :</strong> exécution du contrat, page publique, support, prévention de fraude.</li>
        <li><strong>Base légale :</strong> exécution du contrat et intérêt légitime (sécurité).</li>
        <li><strong>Partage :</strong> prestataires (Stripe, hébergement). Pas de vente de données.</li>
        <li><strong>Conservation :</strong> durée nécessaire aux finalités et obligations légales.</li>
        <li><strong>Droits :</strong> accès/rectification/effacement via <a href="mailto:support@parcelsoftime.com">support@parcelsoftime.com</a>.</li>
      </ul>
    </main>
  );
}
