// PAS de "use client" ici
export default function LoginForm({
  locale,
  nextParam,
}: {
  locale: 'fr' | 'en'
  nextParam?: string
}) {
  const next = nextParam && /^\/(fr|en)\//.test(nextParam) ? nextParam : `/${locale}/account`

  return (
    <form
      method="post"
      action="/api/auth/login"
      style={{ display: 'grid', gap: 12, marginTop: 8 }}
    >
      <input type="hidden" name="next" value={next} />
      <label style={{ display: 'grid', gap: 6 }}>
        <span>E-mail</span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          style={{ padding: '12px 14px', border: '1px solid #ddd', borderRadius: 10 }}
        />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>Mot de passe</span>
        <input
          required
          type="password"
          name="password"
          autoComplete="current-password"
          style={{ padding: '12px 14px', border: '1px solid #ddd', borderRadius: 10 }}
        />
      </label>
      <button
        type="submit"
        style={{ padding: '12px 14px', borderRadius: 10, fontWeight: 700, border: '1px solid #ddd' }}
      >
        Se connecter
      </button>
    </form>
  )
}
