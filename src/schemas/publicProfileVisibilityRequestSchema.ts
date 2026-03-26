import { z } from 'zod'

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

export const publicProfileVisibilityRequestSchema = z.object({
  requestedFieldKeys: z.array(visibilityFieldEnum),
  requestNote: z.string().trim().max(500, 'Keep the note under 500 characters').optional(),
})

export type PublicProfileVisibilityRequestValues = z.infer<
  typeof publicProfileVisibilityRequestSchema
>
