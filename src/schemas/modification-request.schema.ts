import { z } from 'zod'

import type { TranslateFn } from '@/i18n/messages'
import {
  MODIFICATION_REQUEST_FIELD_KEYS,
  type ModificationRequestField,
} from '@/types/modification-request'
import {
  getRequestFieldLabel,
  isModificationRequestValueValid,
  normalizeModificationRequestValue,
} from '@/utils/modification-requests'

const fieldEnum = z.enum(MODIFICATION_REQUEST_FIELD_KEYS)

function getInvalidValueMessage(
  field: ModificationRequestField,
  t: TranslateFn,
): string {
  switch (field) {
    case 'email':
      return t('validation.validEmail')
    case 'telephone':
      return t('validation.request.invalidPhone')
    case 'photo_url':
      return t('validation.employee.invalidUrl')
    case 'date_naissance':
      return t('validation.request.invalidDate')
    case 'nombre_enfants':
      return t('validation.request.invalidNumber')
    default:
      return t('validation.request.invalidSelection', {
        field: getRequestFieldLabel(field, t),
      })
  }
}

export function createModificationRequestSchema(t: TranslateFn) {
  return z
    .object({
      champCible: fieldEnum,
      ancienneValeur: z.string().optional(),
      nouvelleValeur: z.string().optional(),
      motif: z.string().trim().optional(),
    })
    .superRefine((value, ctx) => {
      const normalizedNewValue = normalizeModificationRequestValue(
        value.champCible,
        value.nouvelleValeur,
      )
      const normalizedCurrentValue = normalizeModificationRequestValue(
        value.champCible,
        value.ancienneValeur,
      )

      if (!normalizedNewValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nouvelleValeur'],
          message: t('validation.request.newValueRequired'),
        })
        return
      }

      if (!isModificationRequestValueValid(value.champCible, normalizedNewValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nouvelleValeur'],
          message: getInvalidValueMessage(value.champCible, t),
        })
      }

      if ((normalizedCurrentValue ?? '') === normalizedNewValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nouvelleValeur'],
          message: t('validation.request.newValueDifferent'),
        })
      }
    })
}

export const modificationRequestSchema = createModificationRequestSchema((key) => key)

export type ModificationRequestValues = z.infer<typeof modificationRequestSchema>
