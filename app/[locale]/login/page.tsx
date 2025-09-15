// app/[locale]/login/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { readSession, debugSessionSnapshot } from '@/lib/auth'

type Params = { locale: 'fr' | 'en' }
type Search = { next?: string; err?: string; info?: string; debug?: string }

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
  const showDebug = sp?.debug === '1' // active le panneau debug si ?debug=1

  // --------- si déjà connecté → redirige
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

  // --------- messages d’erreur
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

  // --------- DEBUG serveur (ne fuit aucune donnée sensible)
  const dbg = await debugSessionSnapshot()
  const h = await headers()
  const reqUrl = h.get('referer') || `/${locale}/login`

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px', fontFamily: 'Inter, system-ui' }}>
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
            autoComplete="email"
            style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>{labels.password}</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
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

      {/* ===================== DEBUG ===================== */}
      <details open={showDebug} style={{ marginTop: 18, border: '1px dashed #ccc', borderRadius: 10, padding: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>DEBUG — côté serveur</summary>
        <div style={{ fontSize: 12, lineHeight: '18px', marginTop: 8 }}>
          <div><strong>Request referer:</strong> {reqUrl}</div>
          <div><strong>host:</strong> {dbg.host} — <strong>xfh:</strong> {dbg.xfh} — <strong>proto:</strong> {dbg.proto}</div>
          <div><strong>cookie present:</strong> {String(dbg.cookiePresent)} — <strong>rawLen:</strong> {dbg.rawLen}</div>
          <div><strong>payload:</strong> “{dbg.payloadStart}…{dbg.payloadEnd}” — <strong>sig:</strong> “{dbg.sigStart}…{dbg.sigEnd}”</div>
          <div><strong>sigOk:</strong> {String(dbg.sigOk)} — <strong>parseOk:</strong> {String(dbg.parseOk)} — <strong>reason:</strong> {dbg.reason || '—'}</div>
          <div style={{ marginTop: 6 }}>
            Astuce : ajoute <code>?debug=1</code> à l’URL pour ouvrir ce panneau automatiquement.
          </div>
        </div>
      </details>
    </main>
  )
}
