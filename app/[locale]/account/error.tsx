//app/account/error.tsx
'use client'

export default function Error({ error }: { error: Error }) {
  return (
    <main style={{padding:24, fontFamily:'system-ui'}}>
      <h1>Oups — Mon compte</h1>
      <p>Un souci temporaire est survenu. Réessaie dans un instant.</p>
      <details style={{opacity:.7, marginTop:12}}>
        <summary>Détails techniques</summary>
        <pre>{error?.message}</pre>
      </details>
    </main>
  )
}
