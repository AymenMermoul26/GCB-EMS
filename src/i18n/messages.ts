import type { AppLanguage } from '@/i18n/config'
import ar from '@/i18n/messages.ar'
import en from '@/i18n/messages.en'
import arPhase2 from '@/i18n/messages.phase2.ar'
import enPhase2 from '@/i18n/messages.phase2.en'
import frPhase2 from '@/i18n/messages.phase2.fr'
import fr from '@/i18n/messages.fr'

export type TranslationParams = Record<string, string | number>
export type TranslateFn = (key: string, params?: TranslationParams) => string

type TranslationTree = {
  [key: string]: string | TranslationTree
}

function deepMergeTranslations(
  base: TranslationTree,
  extension: TranslationTree,
): TranslationTree {
  const merged: TranslationTree = { ...base }

  for (const [key, value] of Object.entries(extension)) {
    const baseValue = merged[key]

    if (
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      merged[key] = deepMergeTranslations(baseValue, value)
      continue
    }

    merged[key] = value as string | TranslationTree
  }

  return merged
}

const messages: Record<AppLanguage, TranslationTree> = {
  en: deepMergeTranslations(en, enPhase2),
  fr: deepMergeTranslations(fr, frPhase2),
  ar: deepMergeTranslations(ar, arPhase2),
}

function getMessageValue(
  language: AppLanguage,
  key: string,
): string | TranslationTree | undefined {
  const segments = key.split('.')
  let current: string | TranslationTree | undefined = messages[language]

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template
  }

  return Object.entries(params).reduce((value, [key, paramValue]) => {
    return value.replaceAll(`{${key}}`, String(paramValue))
  }, template)
}

export function translate(
  language: AppLanguage,
  key: string,
  params?: TranslationParams,
): string {
  const value = getMessageValue(language, key) ?? getMessageValue('en', key)

  if (typeof value !== 'string') {
    return key
  }

  return interpolate(value, params)
}

export function createTranslate(language: AppLanguage): TranslateFn {
  return (key, params) => translate(language, key, params)
}
