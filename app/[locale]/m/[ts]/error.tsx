'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main style={{maxWidth:700,margin:'0 auto',padding:24,fontFamily:'Inter,system-ui'}}>
      <h1 style={{margin:0}}>Oups — chargement impossible</h1>
      <p style={{opacity:.8}}>
        Une erreur est survenue pendant l’affichage de la page.
        {error?.digest ? <> (code: <code>{error.digest}</code>)</> : null}
      </p>
      <button onClick={reset} style={{padding:'10px 14px',border:'1px solid #ddd',borderRadius:10,cursor:'pointer'}}>
        Réessayer
      </button>
    </main>
  )
}
