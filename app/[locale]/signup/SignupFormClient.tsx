// app/[locale]/signup/SignupFormClient.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error'

export default function SignupForm({
  locale,
  nextParam,
}: {
  locale: 'fr' | 'en'
  nextParam?: string
}) {
  // --- i18n
  const t = (fr: string, en: string) => (locale === 'fr' ? fr : en)

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
  const [caps1, setCaps1] = useState(false)
  const [caps2, setCaps2] = useState(false)

  const emailInputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => { emailInputRef.current?.focus() }, [])

  // --- validators
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValidEmail = (v: string) => emailRegex.test(v)
  const emailsMatch = !!email && !!email2 && email.trim().toLowerCase() === email2.trim().toLowerCase()

  const usernameRegex = /^[a-zA-Z0-9._-]{3,20}$/
  const usernameClean = useMemo(() => username.trim(), [username])
  const usernameLooksValid = usernameRegex.test(usernameClean)

  const passwordOk = useMemo(() => password.length >= 8, [password])
  const passwordsMatch = !!password && !!password2 && password === password2

  // --- password strength (0–4)
  const pwScore = useMemo(() => {
    const pw = password || ''
    let s = 0
    if (pw.length >= 8) s++
    if (pw.length >= 12) s++
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
    if (/\d/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    // normalize to 0..4
    return Math.min(4, Math.max(0, s - 1))
  }, [password])
  const pwLabel = [
    t('Faible', 'Weak'),
    t('Moyen', 'Fair'),
    t('Bon', 'Good'),
    t('Très bon', 'Very good'),
    t('Excellent', 'Excellent'),
  ][pwScore] || t('Très faible', 'Very weak')

  // --- username availability (debounced)
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
    }, 350)
    return () => { alive = false; clearTimeout(id) }
  }, [usernameClean, usernameLooksValid])

  // --- username suggestions from email
  const usernameSuggestions = useMemo(() => {
    if (!isValidEmail(email)) return []
    const base = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 16)
    const year = new Date().getFullYear().toString().slice(-2)
    const uniq = new Set([base, `${base}${year}`, `${base}_01`].filter(Boolean))
    return Array.from(uniq).filter(v => v.length >= 3 && /^[a-zA-Z0-9._-]+$/.test(v))
  }, [email])

  // --- completion progress
  const completion = useMemo(() => {
    let pct = 0
    if (isValidEmail(email)) pct += 20
    if (emailsMatch) pct += 10
    if (usernameLooksValid) pct += 20
    pct += pwScore * 10 // 0..40
    if (passwordsMatch && passwordOk) pct += 10
    return Math.min(100, pct)
  }, [email, emailsMatch, usernameLooksValid, pwScore, passwordsMatch, passwordOk])

  // --- submit
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)

    if (!isValidEmail(email)) { setErr(t('E-mail invalide.', 'Invalid email.')); return }
    if (!emailsMatch) { setErr(t('Les e-mails ne correspondent pas.', 'Emails do not match.')); return }
    if (!usernameLooksValid) {
      setErr(t('Pseudo invalide. Utilisez 3–20 caractères: lettres, chiffres, ".", "_", "-".', 'Invalid username. Use 3–20 characters: letters, digits, ".", "_", "-".'))
      return
    }
    if (!passwordOk) { setErr(t('Mot de passe trop court (min. 8).', 'Password too short (min. 8).')); return }
    if (!passwordsMatch) { setErr(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.')); return }
    if (userAvail === 'taken') { setErr(t('Ce pseudo est déjà pris.', 'This username is already taken.')); return }

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
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }} aria-describedby="form-progress">
      {/* Progress */}
      <div id="form-progress" style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.85 }}>
          <span>{t('Progression', 'Progress')}</span>
          <span>{completion}%</span>
        </div>
        <div aria-hidden="true" style={{ height: 10, background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${completion}%`, height: '100%', background: 'var(--color-primary)' }} />
        </div>
      </div>

      {/* Email */}
      <label htmlFor="email" style={{ display: 'grid', gap: 6 }}>
        <span>{t('E-mail', 'Email')}</span>
        <input
          id="email"
          ref={emailInputRef}
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
      <label htmlFor="email2" style={{ display: 'grid', gap: 6 }}>
        <span>{t('Confirmez votre e-mail', 'Confirm your email')}</span>
        <input
          id="email2"
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
        <div style={{ fontSize: 12, color: '#ffb2b2' }} role="status" aria-live="polite">
          {t('Les e-mails ne correspondent pas.', 'Emails do not match.')}
        </div>
      )}

      {/* Username */}
      <label htmlFor="username" style={{ display: 'grid', gap: 6 }}>
        <span>{t('Pseudo', 'Username')}</span>
        <input
          id="username"
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder={t('3–20 caractères (lettres, chiffres, . _ -)', '3–20 characters (letters, digits, . _ -)')}
          aria-invalid={!!username && !usernameLooksValid}
          style={{ padding: '12px 14px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,.02)', color: 'var(--color-text)', borderRadius: 10 }}
        />
      </label>

      {/* Username helper row */}
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12 }}>
          {!usernameLooksValid && username.length > 0 && (
            <span style={{ color: '#ffb2b2' }}>
              {t('3–20 caractères. Lettres/chiffres/._- autorisés.', '3–20 characters. Letters, digits, . _ - allowed.')}
            </span>
          )}
          {usernameLooksValid && (
            <span aria-live="polite" style={{ opacity: 0.85 }}>
              {userAvail === 'checking' && t('Vérification du pseudo…', 'Checking username…')}
              {userAvail === 'available' && <span style={{ color: '#65c18c' }}>{t('Disponible ✓', 'Available ✓')}</span>}
              {userAvail === 'taken' && <span style={{ color: '#ffb2b2' }}>{t('Déjà pris ✕', 'Already taken ✕')}</span>}
              {userAvail === 'error' && t('Impossible de vérifier (nous réessayerons).', 'Could not check (we’ll try again).')}
            </span>
          )}
        </div>
        {/* Suggestions */}
        {usernameSuggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {usernameSuggestions.slice(0, 3).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setUsername(s)}
                style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 12 }}
                aria-label={t(`Utiliser le pseudo ${s}`, `Use username ${s}`)}
              >
                ✨ {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Password */}
      <label htmlFor="pw1" style={{ display: 'grid', gap: 6 }}>
        <span>{t('Mot de passe', 'Password')}</span>
        <div style={{ position: 'relative' }}>
          <input
            id="pw1"
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCaps1((e as any).getModifierState?.('CapsLock'))}
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

      {/* Password strength */}
      <div style={{ display: 'grid', gap: 6 }}>
        {!!password && (
          <>
            <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{t('Sécurité du mot de passe', 'Password strength')}</span>
              <strong>{pwLabel}</strong>
            </div>
            <div aria-hidden="true" style={{ height: 8, background: 'rgba(255,255,255,.06)', border: '1px solid var(--color-border)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${(pwScore / 4) * 100}%`, height: '100%', background: 'var(--color-primary)' }} />
            </div>
          </>
        )}
        {caps1 && <div style={{ fontSize: 12, color: '#ffdf8a' }}>⇪ {t('Verr. Maj activé', 'Caps Lock enabled')}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {t('Astuce : combinez lettres, chiffres et symboles.', 'Tip: mix letters, numbers & symbols.')}
          </span>
        </div>
      </div>

      {/* Password confirm */}
      <label htmlFor="pw2" style={{ display: 'grid', gap: 6 }}>
        <span>{t('Confirmer le mot de passe', 'Confirm password')}</span>
        <div style={{ position: 'relative' }}>
          <input
            id="pw2"
            type={showPw2 ? 'text' : 'password'}
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            onKeyUp={(e) => setCaps2((e as any).getModifierState?.('CapsLock'))}
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
        <div style={{ fontSize: 12, color: '#ffb2b2' }} role="status" aria-live="polite">
          {t('Les mots de passe ne correspondent pas.', 'Passwords do not match.')}
        </div>
      )}
      {caps2 && <div style={{ fontSize: 12, color: '#ffdf8a' }}>⇪ {t('Verr. Maj activé', 'Caps Lock enabled')}</div>}

      {/* Error block */}
      {err && (
        <div
          role="alert"
          tabIndex={-1}
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
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" /> {t('Création…', 'Creating…')}
          </>
        ) : (
          t('Créer mon compte', 'Create account')
        )}
      </button>

      {/* tiny inline spinner style */}
      <style>{`
        .spinner {
          width: 16px; height: 16px; border-radius: 999px;
          border: 2px solid rgba(255,255,255,.35); border-top-color: var(--color-on-primary);
          display: inline-block; animation: sp 0.9s linear infinite;
        }
        @keyframes sp { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  )
}
