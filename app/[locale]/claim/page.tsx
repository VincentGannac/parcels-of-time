// app/[locale]/claim/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import ClientClaim from './ClientClaim'
import { readSession, redirectToLogin } from '@/lib/auth'

type Params = { locale: 'fr' | 'en' }

export default async function Page({ params }: { params: Promise<Params> }) {
  const { locale } = await params

  // readSession est async dans votre setup Next 15
  const session = await readSession()
  if (!session) {
    const loginUrl = await redirectToLogin(`/${locale}/claim`)
    redirect(loginUrl)
  }

  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <ClientClaim />
    </Suspense>
  )
}
