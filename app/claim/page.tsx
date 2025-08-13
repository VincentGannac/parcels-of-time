// app/claim/page.tsx
import { Suspense } from 'react'
import ClientClaim from './ClientClaim'

export const dynamic = 'force-dynamic' // évite la pré-génération et l'erreur de prerender

export default function Page() {
  return (
    <Suspense fallback={<main style={{padding:24}}>Loading…</main>}>
      <ClientClaim />
    </Suspense>
  )
}
