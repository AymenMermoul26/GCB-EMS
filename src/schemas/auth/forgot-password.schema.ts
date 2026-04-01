import { z } from 'zod'

import type { TranslateFn } from '@/i18n/messages'

export function createForgotPasswordSchema(t: TranslateFn) {
  return z.object({
    email: z.string().trim().email(t('validation.validEmail')),
  })
}

export const forgotPasswordSchema = createForgotPasswordSchema((key) => key)
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
