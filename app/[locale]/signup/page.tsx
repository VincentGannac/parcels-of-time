// app/[locale]/signup/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'

type Params = { locale: 'fr' | 'en' }
type Search = { next?: string; err?: string }

export default async function SignupPage({
  params,
  searchParams,
}: {
  // Next 15: ces props sont exposées comme Promises
  params: Promise<Params>
  searchParams: Promise<Search>
}) {
  const { locale } = await params
  const sp = await searchParams
  const next = sp?.next ?? ''

  const sess = await readSession()
  if (sess) redirect(next && /^\/(fr|en)\//.test(next) ? next : `/${locale}/account`)

  const labels =
    locale === 'fr'
      ? {
          title: 'Créer un compte',
          email: 'Adresse email',
          password: 'Mot de passe (min. 8)',
          submit: "S'inscrire",
          switch: 'Déjà inscrit ? Se connecter →',
        }
      : {
          title: 'Create account',
          email: 'Email address',
          password: 'Password (min. 8)',
          submit: 'Sign up',
          switch: 'Already have an account? Sign in →',
        }

  const err = sp?.err
  const errText =
    err === 'weak'
      ? locale === 'fr'
        ? 'Mot de passe trop court.'
        : 'Password too short.'
      : err
      ? locale === 'fr'
        ? 'Erreur serveur.'
        : 'Server error.'
      : null

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '32px 20px', fontFamily: 'Inter, system-ui' }}>
      <h1 style={{ margin: '0 0 16px' }}>{labels.title}</h1>

      {errText && (
        <p style={{ color: '#b00', background: '#fee', border: '1px solid #fbb', padding: 10, borderRadius: 8, marginTop: 0 }}>
          {errText}
        </p>
      )}

      {/* action relative pour éviter tout rebond d’hôte */}
      <form action="/api/auth/signup" method="post" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="locale" value={locale} />

        <label style={{ display: 'grid', gap: 6 }}>
          <span>{labels.email}</span>
          <input name="email" type="email" required style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>{labels.password}</span>
          <input name="password" type="password" required minLength={8} style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }} />
        </label>

        <button type="submit" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #0B0B0C', background: '#0B0B0C', color: '#fff' }}>
          {labels.submit}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>
        <a href={`/${locale}/login?next=${encodeURIComponent(next || `/${locale}/account`)}`}>{labels.switch}</a>
      </p>
    </main>
  )
}
