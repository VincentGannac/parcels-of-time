// app/[locale]/login/page.tsx
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { readSession, debugSessionSnapshot } from '@/lib/auth'
import LoginForm from './LoginFormClient'

type Params = { locale: 'fr' | 'en' }
type Search = { next?: string; err?: string; debug?: string }

function errMessage(locale: 'fr' | 'en', code?: string | null) {
  if (!code) return ''
  const FR: Record<string, string> = {
    bad_token: 'Lien de connexion invalide ou expiré.',
    missing_credentials: 'Veuillez renseigner un e-mail et un mot de passe.',
    not_found: 'Compte introuvable (ou méthode de connexion inadaptée).',
    bad_credentials: 'E-mail ou mot de passe incorrect.',
    server_error: 'Erreur serveur. Réessayez.',
    signed_out: 'Vous avez été déconnecté.',
  }
  const EN: Record<string, string> = {
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
  const fr = {
    title: 'Connexion',
    email: 'E-mail',
    password: 'Mot de passe',
    submit: 'Se connecter',
    or: 'ou',
    withLink: 'Se connecter par lien magique',
    linkHelp: 'Si vous avez reçu un e-mail avec un lien, cliquez-le directement.',
    backHome: 'Retour à l’accueil',
  }
  const en = {
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    or: 'or',
    withLink: 'Sign in with magic link',
    linkHelp: 'If you received a sign-in link by email, just click it.',
    backHome: 'Back to home',
  }
  return locale === 'fr' ? fr : en
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const { locale } = params
  const { next, err, debug } = searchParams
  const i18n = t(locale)

  // Si déjà connecté (et pas d’erreur explicite), redirige vers next ou /account
  const sess = await readSession()
  if (sess && (!err || err === '')) {
    const to = next && /^\/(fr|en)\//.test(next) ? next : `/${locale}/account`
    redirect(to)
  }

  const dbg = debug === '1' ? await debugSessionSnapshot() : null

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

      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 34, margin: '0 0 8px' }}>{i18n.title}</h1>

      {err && (
        <div
          role="alert"
          style={{
            margin: '12px 0 16px',
            padding: '12px 14px',
            border: '1px solid #FEE2E2',
            background: '#FEF2F2',
            color: '#991B1B',
            borderRadius: 12,
            fontSize: 14,
          }}
        >
          {errMessage(locale, err)}
        </div>
      )}

      <LoginForm locale={locale} nextParam={typeof next === 'string' ? next : undefined} />

      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 14 }}>
        {i18n.linkHelp}
      </p>

      {dbg && (
        <details style={{ marginTop: 22 }}>
          <summary style={{ cursor: 'pointer' }}>debug</summary>
          <div style={{ marginTop: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
            <div>
              <strong>cookie present:</strong> {String(dbg.cookiePresent)} — <strong>rawLen:</strong> {dbg.rawLen}
            </div>
            <div>
              <strong>host:</strong> {dbg.host} — <strong>xfh:</strong> {dbg.xfh} — <strong>proto:</strong> {dbg.proto}
            </div>
            <div>
              <strong>payload:</strong> “{dbg.payloadStart}…{dbg.payloadEnd}” — <strong>sig:</strong> “{dbg.sigStart}…{dbg.sigEnd}”
            </div>
            <div>
              <strong>sigOk:</strong> {String(dbg.sigOk)} — <strong>parseOk:</strong> {String(dbg.parseOk)} — <strong>reason:</strong> {dbg.reason || '—'}
            </div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(dbg.payload, null, 2)}</pre>
          </div>
        </details>
      )}
    </main>
  )
}
