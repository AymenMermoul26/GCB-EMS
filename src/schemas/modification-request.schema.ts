import { z } from 'zod'

import type { TranslateFn } from '@/i18n/messages'
import type { ModificationRequestField } from '@/types/modification-request'

const fieldEnum = z.enum([
  'poste',
  'email',
  'telephone',
  'photo_url',
  'nom',
  'prenom',
] satisfies [ModificationRequestField, ...ModificationRequestField[]])

export function createModificationRequestSchema(t: TranslateFn) {
  return z
    .object({
      champCible: fieldEnum,
      ancienneValeur: z.string().optional(),
      nouvelleValeur: z.string().trim().min(1, t('validation.request.newValueRequired')),
      motif: z.string().trim().optional(),
    })
    .superRefine((value, ctx) => {
      if ((value.ancienneValeur ?? '').trim() === value.nouvelleValeur.trim()) {
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
