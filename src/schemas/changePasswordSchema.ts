import { z } from 'zod'

import type { TranslateFn } from '@/i18n/messages'

function createNewPasswordRules(t: TranslateFn) {
  return z
    .string()
    .trim()
    .min(8, t('validation.passwordMin'))
}

export function createChangePasswordSchema(t: TranslateFn) {
  return z
    .object({
      currentPassword: z
        .string()
        .trim()
        .min(1, t('validation.currentPasswordRequired')),
      newPassword: createNewPasswordRules(t),
      confirmNewPassword: z
        .string()
        .trim()
        .min(1, t('validation.confirmNewPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmNewPassword'],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: t('validation.newPasswordDifferent'),
      path: ['newPassword'],
    })
}

export function createFirstLoginSetPasswordSchema(t: TranslateFn) {
  return z
    .object({
      newPassword: createNewPasswordRules(t),
      confirmNewPassword: z
        .string()
        .trim()
        .min(1, t('validation.confirmNewPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmNewPassword'],
    })
}

export const changePasswordSchema = createChangePasswordSchema((key) => key)
export const firstLoginSetPasswordSchema = createFirstLoginSetPasswordSchema(
  (key) => key,
)

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
export type FirstLoginSetPasswordFormValues = z.infer<typeof firstLoginSetPasswordSchema>
