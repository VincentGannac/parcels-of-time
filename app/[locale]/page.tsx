// app/[locale]/page.tsx
'use client'
import Link from 'next/link'
import { useT } from '../i18n/I18nProvider'

export default function Landing() {
  const { t } = useT()
  return (
    <main>
      <h1>{t('hero.h1')}</h1>
      <p>{t('hero.subtitle')}</p>
      <div style={{display:'flex', gap:12}}>
        <Link href="/claim" prefetch>{t('cta.claim')}</Link>
        <Link href="/claim?gift=1" prefetch>{t('cta.gift')}</Link>
      </div>
    </main>
  )
}
