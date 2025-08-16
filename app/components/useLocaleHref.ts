// app/components/useLocaleHref.ts
'use client'
import { useT } from '../i18n/I18nProvider'

export function useLocaleHref() {
  const { locale } = useT()
  return (href: string) => {
    if (!href.startsWith('/')) return href
    // évite double préfixe si déjà présent
    if (href.startsWith('/fr/') || href.startsWith('/en/')) return href
    return `/${locale}${href}`
  }
}
