import { z } from 'zod'

import type { TranslateFn } from '@/i18n/messages'
import {
  EMPLOYEE_VISIBILITY_FIELD_KEYS,
  type EmployeeVisibilityFieldKey,
} from '@/types/visibility'

const visibilityFieldEnum = z.enum(
  EMPLOYEE_VISIBILITY_FIELD_KEYS as [
    EmployeeVisibilityFieldKey,
    ...EmployeeVisibilityFieldKey[],
  ],
)

export function createPublicProfileVisibilityRequestSchema(t: TranslateFn) {
  return z.object({
    requestedFieldKeys: z.array(visibilityFieldEnum),
    requestNote: z
      .string()
      .trim()
      .max(500, t('validation.qr.noteMax'))
      .optional(),
  })
}

export const publicProfileVisibilityRequestSchema =
  createPublicProfileVisibilityRequestSchema((key) => key)

export type PublicProfileVisibilityRequestValues = z.infer<
  typeof publicProfileVisibilityRequestSchema
>
