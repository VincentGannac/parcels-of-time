// app/[locale]/login/LoginFormClient.tsx
'use client'

import { useState } from 'react'

export default function LoginForm({ locale, nextParam }: { locale: 'fr' | 'en'; nextParam?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const label = {
    fr: { email: 'E-mail', password: 'Mot de passe', submit: 'Se connecter' },
    en: { email: 'Email', password: 'Password', submit: 'Sign in' },
  }[locale]

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalErr(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next: nextParam || `/${locale}/account` }),
        redirect: 'follow',
      })

      if (res.redirected) {
        window.location.href = res.url
        return
      }

      if (!res.ok) {
        let code = 'server_error'
        try {
          const j = await res.json()
          code = j?.error || code
        } catch {}
        const msg =
          locale === 'fr'
            ? {
                missing_credentials: 'Veuillez renseigner un e-mail et un mot de passe.',
                not_found: 'Compte introuvable (ou méthode de connexion inadaptée).',
                bad_credentials: 'E-mail ou mot de passe incorrect.',
                server_error: 'Erreur serveur. Réessayez.',
              }[code] || 'Erreur.'
            : {
                missing_credentials: 'Please provide email and password.',
                not_found: 'Account not found (or wrong sign-in method).',
                bad_credentials: 'Incorrect email or password.',
                server_error: 'Server error. Please try again.',
              }[code] || 'Error.'
        setLocalErr(msg)
        setLoading(false)
        return
      }

      window.location.href = res.url
    } catch {
      setLocalErr(locale === 'fr' ? 'Erreur réseau.' : 'Network error.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 10 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{label.email}</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            padding: '12px 14px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            background: 'transparent',
          }}
        />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>{label.password}</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{
            padding: '12px 14px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            background: 'transparent',
          }}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          fontWeight: 800,
          border: 'none',
          background: '#111827',
          color: '#fff',
          cursor: loading ? 'progress' : 'pointer',
          boxShadow: loading ? '0 0 0 6px rgba(0,0,0,.06)' : 'none',
        }}
      >
        {loading ? (locale === 'fr' ? 'Connexion…' : 'Signing in…') : label.submit}
      </button>

      {localErr && (
        <div
          role="alert"
          style={{
            marginTop: 4,
            padding: '10px 12px',
            border: '1px solid #FEE2E2',
            background: '#FEF2F2',
            color: '#991B1B',
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          {localErr}
        </div>
      )}
    </form>
  )
}
