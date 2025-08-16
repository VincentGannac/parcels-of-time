'use client'
import { usePathname } from 'next/navigation'

const LOCALES = ['fr', 'en'] as const
function isLocale(seg?: string | null): seg is (typeof LOCALES)[number] {
  return !!seg && (LOCALES as readonly string[]).includes(seg)
}

/**
 * Retourne une fonction qui préfixe tes chemins internes avec la locale actuelle.
 * - Garde intacts les liens externes / mailto / tel / ancres.
 * - Ne double pas le préfixe si path commence déjà par /fr ou /en.
 */
export function useLocaleHref() {
  const pathname = usePathname() || '/'
  const firstSeg = pathname.split('/')[1] || null
  const currentLocale = isLocale(firstSeg) ? firstSeg : 'en'

  return (path: string) => {
    // Laissez tomber si ce n’est pas un chemin interne
    if (!path || !path.startsWith('/')) return path // ex: '#faq', 'mailto:...', 'https://...'

    // Si le chemin a déjà un préfixe de locale, ne rien faire
    const seg = path.split('/')[1] || null
    if (isLocale(seg)) return path

    // Sinon on préfixe
    return `/${currentLocale}${path}`
  }
}
