// app/[locale]/gift/recover/RecoverGiftForm.tsx
'use client'

type Locale = 'fr' | 'en'
function t(locale: Locale) {
  return locale === 'fr'
    ? {
        h1: 'Récupérer un cadeau',
        subtitle: 'Entrez l’ID du certificat, son SHA-256 et le code à 5 caractères.',
        selfNote: 'Vous ne pouvez pas transférer un certificat que vous possédez déjà.',
        fields: { claim_id: 'ID du certificat', cert_hash: 'SHA-256', code: 'Code à 5 caractères' },
        cta: 'Valider le transfert',
        done: 'Transfert réussi. Redirection…',
        error: 'Erreur. Vérifiez vos informations ou réessayez.',
      }
    : {
        h1: 'Recover a gift',
        subtitle: 'Enter the certificate ID, its SHA-256 and the 5-char code.',
        selfNote: 'You can’t transfer a certificate you already own.',
        fields: { claim_id: 'Certificate ID', cert_hash: 'SHA-256', code: '5-char code' },
        cta: 'Confirm transfer',
        done: 'Transfer successful. Redirecting…',
        error: 'Error. Check your inputs or try again.',
      }
}

export default function RecoverGiftForm({
  locale,
  preClaim,
  preHash,
}: {
  locale: Locale
  preClaim: string
  preHash: string
}) {
  const i18n = t(locale)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const msgEl = form.querySelector('[data-msg]') as HTMLElement
    const errEl = form.querySelector('[data-err]') as HTMLElement
    if (msgEl) msgEl.textContent = ''
    if (errEl) errEl.textContent = ''

    try {
      const payload = {
        claim_id: String(data.get('claim_id') || '').trim(),
        cert_hash: String(data.get('cert_hash') || '').trim(),
        code: String(data.get('code') || '').trim().toUpperCase(),
        locale,
      }

      const res = await fetch('/api/claim/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (json?.ok) {
        if (msgEl) msgEl.textContent = i18n.done
        window.location.assign(json.account_url)
      } else {
        if (errEl) errEl.textContent = json?.message || i18n.error
      }
    } catch {
      if (errEl) errEl.textContent = i18n.error
    }
  }

  return (
    <>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36, margin: '10px 0 6px' }}>{i18n.h1}</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>{i18n.subtitle}</p>
      <p style={{ opacity: 0.7, margin: '6px 0 0', fontSize: 13 }}>{i18n.selfNote}</p>

      <form
        onSubmit={onSubmit}
        style={{
          display: 'grid',
          gap: 12,
          marginTop: 10,
          background: '#111726',
          border: '1px solid #1E2A3C',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span>{i18n.fields.claim_id}</span>
          <input
            name="claim_id"
            defaultValue={preClaim}
            required
            style={{
              padding: '12px 14px',
              border: '1px solid #1E2A3C',
              borderRadius: 10,
              background: 'rgba(255,255,255,.02)',
              color: '#E6EAF2',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>{i18n.fields.cert_hash}</span>
          <input
            name="cert_hash"
            defaultValue={preHash}
            required
            style={{
              padding: '12px 14px',
              border: '1px solid #1E2A3C',
              borderRadius: 10,
              background: 'rgba(255,255,255,.02)',
              color: '#E6EAF2',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>{i18n.fields.code}</span>
          <input
            name="code"
            required
            pattern="[A-Z0-9]{5}"
            placeholder="ABCDE"
            style={{
              padding: '12px 14px',
              border: '1px solid #1E2A3C',
              borderRadius: 10,
              background: 'rgba(255,255,255,.02)',
              color: '#E6EAF2',
              textTransform: 'uppercase',
            }}
          />
        </label>

        <button
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #1E2A3C',
            background: '#E4B73D',
            color: '#0B0E14',
            fontWeight: 800,
          }}
        >
          {i18n.cta}
        </button>

        <div data-msg style={{ fontSize: 13, color: '#A7F3D0' }} aria-live="polite" />
        <div data-err style={{ fontSize: 13, color: '#FCA5A5' }} aria-live="assertive" />
      </form>
    </>
  )
}
