/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  DEFAULT_LANGUAGE,
  getDirectionForLanguage,
  getIntlLocale,
  type AppDirection,
  type AppLanguage,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
} from '@/i18n/config'
import { createTranslate, type TranslateFn } from '@/i18n/messages'

interface I18nContextValue {
  language: AppLanguage
  direction: AppDirection
  locale: string
  isRTL: boolean
  setLanguage: (language: AppLanguage) => void
  t: TranslateFn
  languages: typeof LANGUAGE_OPTIONS
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)

    if (stored === 'en' || stored === 'fr' || stored === 'ar') {
      return stored
    }
  } catch {
    // Ignore storage failures and fall back to English.
  }

  return DEFAULT_LANGUAGE
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>(() => readStoredLanguage())

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // Ignore storage failures and keep runtime state.
    }
  }, [language])

  const direction = getDirectionForLanguage(language)
  const locale = getIntlLocale(language)
  const t = useMemo(() => createTranslate(language), [language])

  useEffect(() => {
    const root = document.documentElement
    root.lang = language
    root.dir = direction
    document.body.setAttribute('dir', direction)
  }, [direction, language])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      direction,
      locale,
      isRTL: direction === 'rtl',
      setLanguage: setLanguageState,
      t,
      languages: LANGUAGE_OPTIONS,
    }),
    [direction, language, locale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }

  return context
}
