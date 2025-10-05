// app/[locale]/signup/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'
import SignupForm from './SignupFormClient'

type Params = { locale: 'fr' | 'en' }
type Search = { next?: string; err?: string }

const TOKENS = {
  '--color-bg': '#0B0E14',
  '--color-surface': '#111726',
  '--color-text': '#E6EAF2',
  '--color-muted': '#A7B0C0',
  '--color-primary': '#E4B73D',
  '--color-on-primary': '#0B0E14',
  '--color-border': '#1E2A3C',
  '--shadow-elev1': '0 6px 20px rgba(0,0,0,.35)',
} as const

function t(locale: 'fr' | 'en') {
  const fr = {
    title: 'Créer un compte',
    subtitle: 'Rejoignez la communauté — c’est rapide et gratuit.',
    backHome: 'Retour à l’accueil',
    trust1: 'Aucune carte requise',
    trust2: 'Vous pouvez supprimer votre compte à tout moment',
  }
  const en = {
    title: 'Create an account',
    subtitle: 'Join the community — fast and free.',
    backHome: 'Back to home',
    trust1: 'No card required',
    trust2: 'Delete your account anytime',
  }
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
  const sess = await readSession().catch(() => null)
  if (sess) {
    redirect(next && /^\/(fr|en)\//.test(next) ? next : `/${locale}/account`)
  }

  return (
    <main
      style={{
        ['--color-bg' as any]: TOKENS['--color-bg'],
        ['--color-surface' as any]: TOKENS['--color-surface'],
        ['--color-text' as any]: TOKENS['--color-text'],
        ['--color-muted' as any]: TOKENS['--color-muted'],
        ['--color-primary' as any]: TOKENS['--color-primary'],
        ['--color-on-primary' as any]: TOKENS['--color-on-primary'],
        ['--color-border' as any]: TOKENS['--color-border'],
        ['--shadow-elev1' as any]: TOKENS['--shadow-elev1'],
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui',
      }}
    >
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <a href={`/${locale}`} style={{ textDecoration: 'none', color: 'var(--color-text)', opacity: 0.85 }}>
            &larr; Parcels of Time
          </a>
          <a
            href={`/${locale}`}
            style={{
              textDecoration: 'none',
              border: '1px solid var(--color-border)',
              padding: '8px 12px',
              borderRadius: 10,
              color: 'var(--color-text)',
            }}
          >
            {i18n.backHome}
          </a>
        </header>

        {/* Title */}
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36, margin: 0 }}>{i18n.title}</h1>
          <p style={{ margin: '6px 0 0', opacity: 0.8 }}>{i18n.subtitle}</p>
        </div>

        {/* Card */}
        <section
          style={{
            display: 'grid',
            gap: 16,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: 16,
            boxShadow: 'var(--shadow-elev1)',
          }}
        >
          <SignupForm locale={locale} nextParam={typeof next === 'string' ? next : undefined} />

          {/* Trust signals */}
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              borderTop: '1px solid var(--color-border)',
              paddingTop: 10,
              opacity: 0.85,
              fontSize: 13,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border)', borderRadius: 999, padding: '6px 10px' }}>
              ✅ {i18n.trust1}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border)', borderRadius: 999, padding: '6px 10px' }}>
              🔒 {i18n.trust2}
            </span>
          </div>
        </section>

        {/* Login link */}
        <p style={{ marginTop: 12, fontSize: 14 }}>
          {locale === 'fr' ? 'Déjà un compte ?' : 'Already have an account?'}{' '}
          <a href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: 'var(--color-text)' }}>
            {locale === 'fr' ? 'Se connecter' : 'Sign in'}
          </a>
        </p>
      </section>
    </main>
  )
}
