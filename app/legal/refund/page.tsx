//app/legal/refund/page.tsx

export default function Page() {
  return (
    <main style={{ fontFamily:'Inter, system-ui', background:'#FAF9F7', color:'#0B0B0C', minHeight:'100vh', padding:32 }}>
      <a href="/" style={{ textDecoration:'none', color:'#0B0B0C', opacity:0.8 }}>&larr; Parcels of Time</a>
      <h1 style={{ fontSize:40, margin:'16px 0' }}>Rétractation & remboursements</h1>
      <p><strong>Contenu numérique livré immédiatement :</strong> en achetant, vous demandez l’exécution immédiate et <strong>renoncez</strong> au droit de rétractation de 14 jours (directive UE). Cette renonciation est confirmée lors du paiement.</p>
      <p>Erreurs de facturation ou doublons : remboursement intégral si la seconde n’a pas été effectivement revendiquée ou en cas de transaction dupliquée.</p>
      <p>Contact : <a href="mailto:support@parcelsoftime.com">support@parcelsoftime.com</a>.</p>
      <p style={{ opacity:0.7 }}>Texte indicatif, à adapter selon votre statut et à faire relire par un conseil.</p>
    </main>
  );
}
