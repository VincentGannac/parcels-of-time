'use client'

import { useEffect, useMemo, useState } from 'react'

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error'

export default function SignupForm({
  locale,
  nextParam,
}: {
  locale: 'fr' | 'en'
  nextParam?: string
}) {
  // --- state
  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [userAvail, setUserAvail] = useState<Availability>('idle')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // --- i18n helpers
  const t = (fr: string, en: string) => (locale === 'fr' ? fr : en)

  // --- validators
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValidEmail = (v: string) => emailRegex.test(v)
  const emailsMatch = email && email2 && email.trim().toLowerCase() === email2.trim().toLowerCase()

  // Pseudo: 3–20 chars, lettres/chiffres . _ -
  const usernameRegex = /^[a-zA-Z0-9._-]{3,20}$/
  const usernameClean = useMemo(() => username.trim(), [username])
  const usernameLooksValid = usernameRegex.test(usernameClean)

  const passwordOk = password.length >= 8
  const passwordsMatch = password && password2 && password === password2

  // --- debounce username availability check
  useEffect(() => {
    let alive = true
    if (!usernameClean || !usernameLooksValid) {
      setUserAvail('idle')
      return
    }
    setUserAvail('checking')
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(usernameClean)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        })
        if (!alive) return
        if (res.ok) {
          const j = await res.json().catch(() => ({}))
          const available = j?.available !== false
          setUserAvail(available ? 'available' : 'taken')
        } else if (res.status === 409) {
          setUserAvail('taken')
        } else {
          setUserAvail('error')
        }
      } catch {
        setUserAvail('error')
      }
    }, 400)

    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [usernameClean, usernameLooksValid])

  // --- submit
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)

    if (!isValidEmail(email)) {
      setErr(t('E-mail invalide.', 'Invalid email.'))
      return
    }
    if (!emailsMatch) {
      setErr(t('Les e-mails ne correspondent pas.', 'Emails do not match.'))
      return
    }
    if (!usernameLooksValid) {
      setErr(
        t(
          'Pseudo invalide. Utilisez 3–20 caractères: lettres, chiffres, ".", "_", "-".',
          'Invalid username. Use 3–20 characters: letters, digits, ".", "_", "-".'
        )
      )
      return
    }
    if (!passwordOk) {
      setErr(t('Mot de passe trop court (min. 8).', 'Password too short (min. 8).'))
      return
    }
    if (!passwordsMatch) {
      setErr(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.'))
      return
    }
    if (userAvail === 'taken') {
      setErr(t('Ce pseudo est déjà pris.', 'This username is already taken.'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: usernameClean }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const code = j?.error
        const map: Record<string, string> = {
          missing_fields: t('Veuillez renseigner e-mail et mot de passe.', 'Please provide email and password.'),
          bad_email: t('E-mail invalide.', 'Invalid email.'),
          weak_password: t('Mot de passe trop court (min. 8).', 'Password too short (min. 8).'),
          email_taken: t('Un compte existe déjà avec cet e-mail.', 'An account already exists for this email.'),
          username_taken: t('Ce pseudo est déjà pris.', 'This username is already taken.'),
          display_name_taken: t('Ce pseudo est déjà pris.', 'This username is already taken.'),
          server_error: t('Erreur serveur. Réessayez.', 'Server error. Try again.'),
        }
        setErr(map[code] || t('Erreur.', 'Error.'))
        setLoading(false)
        return
      }

      const next = nextParam && /^\/(fr|en)\//.test(nextParam) ? nextParam : `/${locale}/account`
      window.location.href = next
    } catch {
      setErr(t('Erreur réseau.', 'Network error.'))
      setLoading(false)
    }
  }

  const canSubmit =
    !loading &&
    isValidEmail(email) &&
    emailsMatch &&
    usernameLooksValid &&
    passwordOk &&
    passwordsMatch &&
    userAvail !== 'taken' &&
    userAvail !== 'checking'

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      {/* Email */}
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('E-mail', 'Email')}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!email && !isValidEmail(email)}
          style={{ padding: '12px 14px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,.02)', color: 'var(--color-text)', borderRadius: 10 }}
        />
      </label>

      {/* Email confirmation */}
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('Confirmez votre e-mail', 'Confirm your email')}</span>
        <input
          type="email"
          required
          value={email2}
          onChange={(e) => setEmail2(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!email2 && !emailsMatch}
          style={{ padding: '12px 14px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,.02)', color: 'var(--color-text)', borderRadius: 10 }}
        />
      </label>
      {!!email2 && !emailsMatch && (
        <div style={{ fontSize: 12, color: '#ffb2b2' }}>
          {t('Les e-mails ne correspondent pas.', 'Emails do not match.')}
        </div>
      )}

      {/* Username / Pseudo */}
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('Pseudo', 'Username')}</span>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder=""
          aria-invalid={!!username && !usernameLooksValid}
          style={{ padding: '12px 14px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,.02)', color: 'var(--color-text)', borderRadius: 10 }}
        />
      </label>
      {usernameClean && (
        <div style={{ fontSize: 12, marginTop: -6 }}>
          {!usernameLooksValid && (
            <span style={{ color: '#ffb2b2' }}>
              {t('3–20 caractères. Lettres/chiffres/._- autorisés.', '3–20 characters. Letters, digits, . _ - allowed.')}
            </span>
          )}
          {usernameLooksValid && userAvail === 'checking' && (
            <span style={{ opacity: 0.7 }}>{t('Vérification du pseudo…', 'Checking username…')}</span>
          )}
          {usernameLooksValid && userAvail === 'available' && (
            <span style={{ color: '#65c18c' }}>{t('Disponible ✓', 'Available ✓')}</span>
          )}
          {usernameLooksValid && userAvail === 'taken' && (
            <span style={{ color: '#ffb2b2' }}>{t('Déjà pris ✕', 'Already taken ✕')}</span>
          )}
          {usernameLooksValid && userAvail === 'error' && (
            <span style={{ opacity: 0.7 }}>
              {t('Impossible de vérifier. Nous tenterons lors de la création.', 'Could not check. We will verify on submit.')}
            </span>
          )}
        </div>
      )}

      {/* Password */}
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('Mot de passe', 'Password')}</span>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!password && !passwordOk}
            style={{ padding: '12px 44px 12px 14px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,.02)', color: 'var(--color-text)', borderRadius: 10, width: '100%' }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            aria-pressed={showPw}
            title={showPw ? t('Masquer', 'Hide') : t('Afficher', 'Show')}
            style={{ position: 'absolute', right: 8, top: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            {showPw ? t('Masquer', 'Hide') + ' 🙈' : t('Afficher', 'Show') + ' 👁'}
          </button>
        </div>
      </label>
      {!!password && !passwordOk && (
        <div style={{ fontSize: 12, color: '#ffb2b2' }}>
          {t('Au moins 8 caractères.', 'At least 8 characters.')}
        </div>
      )}

      {/* Password confirm */}
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('Confirmer le mot de passe', 'Confirm password')}</span>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw2 ? 'text' : 'password'}
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!password2 && !passwordsMatch}
            style={{ padding: '12px 44px 12px 14px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,.02)', color: 'var(--color-text)', borderRadius: 10, width: '100%' }}
          />
          <button
            type="button"
            onClick={() => setShowPw2(v => !v)}
            aria-pressed={showPw2}
            title={showPw2 ? t('Masquer', 'Hide') : t('Afficher', 'Show')}
            style={{ position: 'absolute', right: 8, top: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            {showPw2 ? t('Masquer', 'Hide') + ' 🙈' : t('Afficher', 'Show') + ' 👁'}
          </button>
        </div>
      </label>
      {!!password2 && !passwordsMatch && (
        <div style={{ fontSize: 12, color: '#ffb2b2' }}>
          {t('Les mots de passe ne correspondent pas.', 'Passwords do not match.')}
        </div>
      )}

      {/* Error block */}
      {err && (
        <div
          role="alert"
          style={{
            marginTop: 2,
            padding: '10px 12px',
            border: '1px solid #FEE2E2',
            background: '#FEF2F2',
            color: '#991B1B',
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          {err}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          fontWeight: 800,
          cursor: loading ? 'progress' : canSubmit ? 'pointer' : 'not-allowed',
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          border: '1px solid var(--color-border)',
          opacity: canSubmit ? 1 : 0.7,
        }}
      >
        {loading ? t('Création…', 'Creating…') : t('Créer mon compte', 'Create account')}
      </button>
    </form>
  )
}
