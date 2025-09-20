//app/[locale]/signup/SignupFormClient.tsx

'use client'

import { useState } from 'react'

export default function SignupForm({
  locale,
  nextParam,
}: {
  locale: 'fr' | 'en'
  nextParam?: string
}) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const t = (fr: string, en: string) => (locale === 'fr' ? fr : en)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const map: Record<string, string> = {
          missing_fields: t('Veuillez renseigner e-mail et mot de passe.', 'Please provide email and password.'),
          bad_email: t('E-mail invalide.', 'Invalid email.'),
          weak_password: t('Mot de passe trop court (min. 8).', 'Password too short (min. 8).'),
          email_taken: t('Un compte existe déjà avec cet e-mail.', 'An account already exists for this email.'),
          server_error: t('Erreur serveur. Réessayez.', 'Server error. Try again.'),
        }
        setErr(map[j.error] || t('Erreur.', 'Error.'))
        setLoading(false)
        return
      }
      // OK -> rediriger
      const next = nextParam && /^\/(fr|en)\//.test(nextParam) ? nextParam : `/${locale}/account`
      window.location.href = next
    } catch (e) {
      setErr(t('Erreur réseau.', 'Network error.'))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('E-mail', 'Email')}</span>
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}
        />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('Nom affiché', 'Display name')}</span>
        <input
          type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
          placeholder={t('Ex. “Camille & Jonas”', 'e.g. “Camille & Jonas”')}
          style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}
        />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('Mot de passe', 'Password')}</span>
        <input
          type="password" required value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}
        />
      </label>

      {err && (
        <div
          role="alert"
          style={{
            marginTop: 2, padding: '10px 12px', border: '1px solid #FEE2E2',
            background: '#FEF2F2', color: '#991B1B', borderRadius: 10, fontSize: 14,
          }}
        >
          {err}
        </div>
      )}

      <button
        type="submit" disabled={loading}
        style={{
          padding: '12px 14px', borderRadius: 12, fontWeight: 800, cursor: loading ? 'progress' : 'pointer',
          background: '#E4B73D', color: '#0B0E14', border: '1px solid transparent',
        }}
      >
        {loading ? t('Création…', 'Creating…') : t('Créer mon compte', 'Create account')}
      </button>
    </form>
  )
}
