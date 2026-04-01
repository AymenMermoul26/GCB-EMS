import { z } from 'zod'

import type { TranslateFn } from '@/i18n/messages'

export function createLoginSchema(t: TranslateFn) {
  return z.object({
    email: z.string().email(t('validation.invalidEmail')),
    password: z.string().min(8, t('validation.passwordMin')),
  })
}

export const loginSchema = createLoginSchema((key) => key)
export type LoginInput = z.infer<typeof loginSchema>
