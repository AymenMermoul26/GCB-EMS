export type AppLanguage = 'en' | 'fr' | 'ar'
export type AppDirection = 'ltr' | 'rtl'

export const DEFAULT_LANGUAGE: AppLanguage = 'en'
export const LANGUAGE_STORAGE_KEY = 'gcb.app.language'

export const LANGUAGE_OPTIONS: Array<{
  value: AppLanguage
  label: string
  shortLabel: string
}> = [
  { value: 'en', label: 'English', shortLabel: 'EN' },
  { value: 'fr', label: 'Français', shortLabel: 'FR' },
  { value: 'ar', label: 'العربية', shortLabel: 'AR' },
]

export function getDirectionForLanguage(language: AppLanguage): AppDirection {
  return language === 'ar' ? 'rtl' : 'ltr'
}

export function isRtlLanguage(language: AppLanguage): boolean {
  return getDirectionForLanguage(language) === 'rtl'
}

export function getIntlLocale(language: AppLanguage): string {
  if (language === 'fr') {
    return 'fr-FR'
  }

  if (language === 'ar') {
    return 'ar-DZ'
  }

  return 'en'
}
