// app/[locale]/login/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth'

type Params = { locale: 'fr' | 'en' }
type Search = { next?: string; err?: string; info?: string }

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Search>
}) {
  const { locale = 'en' } = await params
  const sp = await searchParams
  const next = sp?.next || `/${locale}/account`

  const sess = await readSession()
  if (sess) redirect(next)

  const labels =
    locale === 'fr'
      ? {
          title: 'Connexion',
          email: 'Adresse email',
          password: 'Mot de passe',
          submit: 'Se connecter',
          switch: "Pas de compte ? S'inscrire →",
        }
      : {
          title: 'Sign in',
          email: 'Email address',
          password: 'Password',
          submit: 'Sign in',
          switch: 'No account? Sign up →',
        }

  // ---------- Bandeau d’erreur clair ----------
  const errKey = sp?.err
  const errText =
    errKey === 'missing'
      ? locale === 'fr'
        ? 'Email et mot de passe requis.'
        : 'Email and password are required.'
      : errKey === 'badcreds'
      ? locale === 'fr'
        ? 'Identifiants invalides. Vérifiez votre email et votre mot de passe.'
        : 'Invalid credentials. Check your email and password.'
      : errKey === 'server'
      ? locale === 'fr'
        ? 'Erreur serveur. Réessayez dans un instant.'
        : 'Server error. Please try again.'
      : null

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '32px 20px', fontFamily: 'Inter, system-ui' }}>
      <h1 style={{ margin: '0 0 16px' }}>{labels.title}</h1>

      {errText && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            marginTop: 0,
            marginBottom: 8,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #f19999',
            background: '#ffecec',
            color: '#8a1f1f',
            fontWeight: 600,
          }}
        >
          {errText}
        </div>
      )}

      {sp?.info === 'magic_disabled' && (
        <p style={{ background: '#eef7ff', border: '1px solid #cbe4ff', padding: 10, borderRadius: 8 }}>
          {locale === 'fr'
            ? "La connexion par lien magique n'est plus disponible. Connectez-vous avec votre mot de passe."
            : 'Magic link sign-in is disabled. Please sign in with your password.'}
        </p>
      )}

      <form action="/api/auth/login" method="post" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="locale" value={locale} />

        <label style={{ display: 'grid', gap: 6 }}>
          <span>{labels.email}</span>
          <input
            name="email"
            type="email"
            required
            style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>{labels.password}</span>
          <input
            name="password"
            type="password"
            required
            style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #0B0B0C',
            background: '#0B0B0C',
            color: '#fff',
          }}
        >
          {labels.submit}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>
        <a href={`/${locale}/signup?next=${encodeURIComponent(next)}`}>{labels.switch}</a>
      </p>
    </main>
  )
}
