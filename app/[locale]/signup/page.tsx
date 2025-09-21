export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import SignupForm from './SignupFormClient'

type Params = { locale: 'fr' | 'en' }
type Search = { next?: string; err?: string }

function t(locale: 'fr' | 'en') {
  const fr = { title: 'Créer un compte', backHome: 'Retour à l’accueil' }
  const en = { title: 'Create an account', backHome: 'Back to home' }
  return locale === 'fr' ? fr : en
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Search>
}) {
  const { locale } = await params
  const { next } = await searchParams
  const i18n = t(locale)

  // Déjà connecté ? → redirige
  const sess = await readSession()
  if (sess) {
    redirect(next && /^\/(fr|en)\//.test(next) ? next : `/${locale}/account`)
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '36px 20px', fontFamily: 'Inter, system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <a href={`/${locale}`} style={{ textDecoration: 'none', opacity: 0.85 }}>
          &larr; Parcels of Time
        </a>
        <a
          href={`/${locale}`}
          style={{
            textDecoration: 'none',
            border: '1px solid #e5e7eb',
            padding: '8px 12px',
            borderRadius: 10,
            color: 'inherit',
          }}
        >
          {i18n.backHome}
        </a>
      </header>

      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 34, margin: '0 0 12px' }}>{i18n.title}</h1>
      <SignupForm locale={locale} nextParam={typeof next === 'string' ? next : undefined} />
      <p style={{ marginTop: 12, fontSize: 14 }}>
        {locale === 'fr' ? 'Déjà un compte ?' : 'Already have an account?'}{' '}
        <a href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
          {locale === 'fr' ? 'Se connecter' : 'Sign in'}
        </a>
      </p>
    </main>
  )
}
