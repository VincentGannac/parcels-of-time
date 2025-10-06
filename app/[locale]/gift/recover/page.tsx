// app/[locale]/gift/recover/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import RecoverGiftForm from './RecoverGiftForm'

type Params = { locale: 'fr' | 'en' }

export default async function Page({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Record<string, string | undefined>
}) {
  const { locale } = params
  const sp = searchParams || {}
  const sess = await readSession()

  if (!sess) {
    const qs = sp?.claim_id || sp?.cert_hash ? `?${new URLSearchParams(sp as Record<string, string>).toString()}` : ''
    const nextPath = `/${locale}/gift/recover${qs}`
    redirect(`/${locale}/login?next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0B0E14', color: '#E6EAF2', fontFamily: 'Inter, system-ui' }}>
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
        <a href={`/${locale}/account`} style={{ textDecoration: 'none', color: '#E6EAF2', opacity: 0.85 }}>
          &larr; {locale === 'fr' ? 'Mon compte' : 'My account'}
        </a>
        <RecoverGiftForm
          locale={locale}
          preClaim={sp?.claim_id ?? ''}
          preHash={sp?.cert_hash ?? ''}
        />
      </section>
    </main>
  )
}
