// app/[locale]/signup/SignupFormClient.tsx

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

  // --- debounce username availability check
  useEffect(() => {
    let alive = true
    // Reset si vide/invalid
    if (!usernameClean) {
      setUserAvail('idle')
      return
    }
    if (!usernameLooksValid) {
      setUserAvail('idle')
      return
    }

    setUserAvail('checking')
    const id = setTimeout(async () => {
      try {
        // Endpoint optionnel côté serveur:
        // - 200 {available:true} => ok
        // - 409 {available:false} (ou 200 {available:false}) => pris
        const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(usernameClean)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        })
        if (!alive) return
        if (res.ok) {
          const j = await res.json().catch(() => ({}))
          const available = j?.available !== false // par défaut, considère disponible si non précisé
          setUserAvail(available ? 'available' : 'taken')
        } else if (res.status === 409) {
          setUserAvail('taken')
        } else {
          // Si l’endpoint n’existe pas / renvoie autre chose, on ne bloque pas l’inscription :
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

    // validations rapides côté client
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
    if (userAvail === 'taken') {
      setErr(t('Ce pseudo est déjà pris.', 'This username is already taken.'))
      return
    }
    // Si la vérif d’unicité est en erreur (endpoint manquant), on laisse le serveur trancher
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // On envoie le pseudo dans display_name pour réutiliser sess.displayName dans /account
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
          username_taken: t('Ce pseudo est déjà pris.', 'This username is already taken.'), // <-- prévois ce code côté API si possible
          display_name_taken: t('Ce pseudo est déjà pris.', 'This username is already taken.'), // variante serveur
          server_error: t('Erreur serveur. Réessayez.', 'Server error. Try again.'),
        }
        setErr(map[code] || t('Erreur.', 'Error.'))
        setLoading(false)
        return
      }

      // ✅ OK -> rediriger
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
    userAvail !== 'taken' &&
    userAvail !== 'checking' // on évite de soumettre pendant la vérif

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
          style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}
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
          style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}
        />
      </label>
      {!!email2 && !emailsMatch && (
        <div style={{ fontSize: 12, color: '#991B1B' }}>
          {t('Les e-mails ne correspondent pas.', 'Emails do not match.')}
        </div>
      )}

      {/* Username / Pseudo */}
      <label style={{ display: 'grid', gap: 6 }}>
        <span>{t('Pseudo (unique)', 'Username (unique)')}</span>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder={t('Ex. “Camille_Jonas”', 'e.g. “Camille_Jonas”')}
          aria-invalid={!!username && !usernameLooksValid}
          style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}
        />
      </label>
      {/* Availability hint */}
      {usernameClean && (
        <div style={{ fontSize: 12, marginTop: -6 }}>
          {!usernameLooksValid && (
            <span style={{ color: '#991B1B' }}>
              {t(
                '3–20 caractères. Lettres/chiffres/._- autorisés.',
                '3–20 characters. Letters, digits, . _ - allowed.'
              )}
            </span>
          )}
          {usernameLooksValid && userAvail === 'checking' && (
            <span style={{ opacity: 0.7 }}>{t('Vérification du pseudo…', 'Checking username…')}</span>
          )}
          {usernameLooksValid && userAvail === 'available' && (
            <span style={{ color: '#065F46' }}>{t('Disponible ✓', 'Available ✓')}</span>
          )}
          {usernameLooksValid && userAvail === 'taken' && (
            <span style={{ color: '#991B1B' }}>{t('Déjà pris ✕', 'Already taken ✕')}</span>
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
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={!!password && !passwordOk}
          style={{ padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10 }}
        />
      </label>
      {!!password && !passwordOk && (
        <div style={{ fontSize: 12, color: '#991B1B' }}>
          {t('Au moins 8 caractères.', 'At least 8 characters.')}
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
          background: '#E4B73D',
          color: '#0B0E14',
          border: '1px solid transparent',
          opacity: canSubmit ? 1 : 0.7,
        }}
      >
        {loading ? t('Création…', 'Creating…') : t('Créer mon compte', 'Create account')}
      </button>
    </form>
  )
}
