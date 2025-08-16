'use client'

import React, { createContext, useContext, useMemo } from 'react'

type Dict = Record<string, any>

type Ctx = { locale: 'fr' | 'en'; dict: Dict }
const I18nCtx = createContext<Ctx | null>(null)

export function I18nProvider({ locale, dict, children }:{
  locale: 'fr' | 'en', dict: Dict, children: React.ReactNode
}) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  const { dict, locale } = ctx

  const t = (key: string, vars?: Record<string,string|number>) => {
    const val = key.split('.').reduce<any>((acc, k) => (acc ? acc[k] : undefined), dict)
    let out = (val ?? key) as string
    if (vars) for (const [k,v] of Object.entries(vars)) out = out.replace(new RegExp(`{${k}}`,'g'), String(v))
    return out
  }

  return { t, locale }
}
