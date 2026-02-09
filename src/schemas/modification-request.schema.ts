import { z } from 'zod'

import type { ModificationRequestField } from '@/types/modification-request'

const fieldEnum = z.enum([
  'poste',
  'email',
  'telephone',
  'photo_url',
  'nom',
  'prenom',
] satisfies [ModificationRequestField, ...ModificationRequestField[]])

export const modificationRequestSchema = z
  .object({
    champCible: fieldEnum,
    ancienneValeur: z.string().optional(),
    nouvelleValeur: z.string().trim().min(1, 'New value is required'),
    motif: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.ancienneValeur ?? '').trim() === value.nouvelleValeur.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nouvelleValeur'],
        message: 'New value must be different from current value',
      })
    }
  })

export type ModificationRequestValues = z.infer<typeof modificationRequestSchema>
