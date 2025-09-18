export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession, debugSessionSnapshot } from '@/lib/auth'

type Params = { locale: 'fr' | 'en' }
type Search = { next?: string; err?: string; debug?: string }

function errMessage(locale: 'fr' | 'en', code?: string | null) {
  if (!code) return ''
  const FR: Record<string,string> = {
    bad_token: 'Lien de connexion invalide ou expiré.',
    missing_credentials: 'Veuillez renseigner un e-mail et un mot de passe.',
    not_found: 'Compte introuvable (ou méthode de connexion inadaptée).',
    bad_credentials: 'E-mail ou mot de passe incorrect.',
    server_error: 'Erreur serveur. Réessayez.',
    signed_out: 'Vous avez été déconnecté.',
  }
  const EN: Record<string,string> = {
    bad_token: 'Invalid or expired sign-in link.',
    missing_credentials: 'Please provide email and password.',
    not_found: 'Account not found (or wrong sign-in method).',
    bad_credentials: 'Incorrect email or password.',
    server_error: 'Server error. Please try again.',
    signed_out: 'You have been signed out.',
  }
  return (locale === 'fr' ? FR : EN)[code] || (locale === 'fr' ? 'Erreur.' : 'Error.')
}

function t(locale: 'fr' | 'en') {
  const fr = { title: 'Connexion', backHome: 'Retour à l’accueil', email: 'E-mail', password: 'Mot de passe', cta: 'Se connecter', noAccount: 'Pas de compte ? Créez-le', signup: 'Créer un compte', linkHelp: 'Si vous avez reçu un e-mail avec un lien, cliquez-le directement.' }
  const en = { title: 'Sign in', backHome: 'Back to home', email: 'Email', password: 'Password', cta: 'Sign in', noAccount: 'No account? Create one', signup: 'Create account', linkHelp: 'If you received a sign-in link by email, just click it.' }
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
  const { next, err, debug } = await searchParams
  const i18n = t(locale)

  const sess = await readSession()
  if (sess && (!err || err === '')) {
    redirect(next && /^\/(fr|en)\//.test(next) && !/^\/(fr|en)\/login/.test(next) ? next : `/${locale}/account`)
  }

  const dbg = debug === '1' ? await debugSessionSnapshot() : null

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '36px 20px', fontFamily: 'Inter, system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <a href={`/${locale}`} style={{ textDecoration: 'none', opacity: 0.85 }}>&larr; Parcels of Time</a>
        <a href={`/${locale}`} style={{ textDecoration: 'none', border: '1px solid #e5e7eb', padding: '8px 12px', borderRadius: 10, color: 'inherit' }}>{i18n.backHome}</a>
      </header>

      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 34, margin: '0 0 8px' }}>{i18n.title}</h1>

      {err && (
        <div role="alert" style={{ margin: '12px 0 16px', padding: '12px 14px', border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#991B1B', borderRadius: 12, fontSize: 14 }}>
          {errMessage(locale, err)}
        </div>
      )}

      {/* ✅ Formulaire HTML: POST vers /api/auth/login (pas de JS, redirection 303 atomique) */}
      <form method="POST" action="/api/auth/login" style={{ display: 'grid', gap: 12 }}>
        <input type="hidden" name="next" value={typeof next === 'string' ? next : `/${locale}/account`} />
        <label style={{ display: 'grid', gap: 6 }}>
          <span>{i18n.email}</span>
          <input name="email" type="email" required placeholder="you@example.com" style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>{i18n.password}</span>
          <input name="password" type="password" required placeholder="••••••••" style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }} />
        </label>
        <button type="submit" style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#111827', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
          {i18n.cta}
        </button>
      </form>

      <div style={{ marginTop: 10, fontSize: 14 }}>
        {i18n.noAccount} — <a href={`/${locale}/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}>{i18n.signup}</a>
      </div>

      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 14 }}>{i18n.linkHelp}</p>

      {dbg && (
        <details style={{ marginTop: 22 }}>
          <summary style={{ cursor: 'pointer' }}>debug</summary>
          <div style={{ marginTop: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
            <div><strong>cookie present:</strong> {String(dbg.cookiePresent)} — <strong>rawLen:</strong> {dbg.rawLen}</div>
            <div><strong>host:</strong> {dbg.host} — <strong>xfh:</strong> {dbg.xfh} — <strong>proto:</strong> {dbg.proto}</div>
            <div><strong>payload:</strong> “{dbg.payloadStart}…{dbg.payloadEnd}” — <strong>sig:</strong> “{dbg.sigStart}…{dbg.sigEnd}”</div>
            <div><strong>sigOk:</strong> {String(dbg.sigOk)} — <strong>parseOk:</strong> {String(dbg.parseOk)} — <strong>reason:</strong> {dbg.reason || '—'}</div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(dbg.payload, null, 2)}</pre>
          </div>
        </details>
      )}
    </main>
  )
}
