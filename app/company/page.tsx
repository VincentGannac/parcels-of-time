// app/company/page.tsx
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
      <a
        href="/"
        style={{ textDecoration: 'none', color: '#0B0B0C', opacity: 0.8 }}
      >
        &larr; Parcels of Time
      </a>

      <h1 style={{ fontSize: 40, margin: '16px 0' }}>À propos</h1>

      <p>
        <strong>Parcels of Time</strong> est une collection numérique minimaliste : la
        revendication symbolique d’une <strong>seconde unique</strong>, enregistrée
        dans un registre public et accompagnée d’un certificat signé.
      </p>

      <ul>
        <li>
          <strong>Ce que nous vendons :</strong> un certificat numérique + une page
          publique attestant de la revendication symbolique d’un instant précis (UTC).
        </li>
        <li>
          <strong>Livraison :</strong> immédiate après paiement, par e-mail et via votre
          page publique.
        </li>
        <li>
          <strong>Tarifs indicatifs :</strong> Classic 49 € / Premium 790 € (secondes à
          motifs).
        </li>
      </ul>

      <p style={{ opacity: 0.75 }}>
        Parcels of Time n’est pas un produit financier et n’accorde aucun droit légal
        sur le temps.
      </p>
    </main>
  );
}
