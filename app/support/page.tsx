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
      <h1 style={{ fontSize: 40, margin: '16px 0' }}>Support</h1>

      <p>Besoin d’aide ? Contactez-nous :</p>
      <ul>
        <li>
          <strong>E-mail :</strong>{' '}
          <a href="mailto:support@parcelsoftime.com">support@parcelsoftime.com</a> (réponse sous 48 h ouvrées)
        </li>
        <li>
          <strong>Téléphone :</strong> +33 7 78 18 16 29 (lun–ven, 10h–17h CET)
        </li>
      </ul>

      <p>Ressources :</p>
      <ul>
        <li><a href="/legal/refund">Politique de rétractation & remboursements</a></li>
        <li><a href="/legal/terms">Conditions générales</a></li>
        <li><a href="/legal/privacy">Confidentialité</a></li>
      </ul>
    </main>
  );
}
