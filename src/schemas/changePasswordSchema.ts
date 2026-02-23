import { z } from 'zod'

const newPasswordRules = z
  .string()
  .trim()
  .min(8, 'New password must be at least 8 characters.')

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .trim()
      .min(1, 'Current password is required.'),
    newPassword: newPasswordRules,
    confirmNewPassword: z
      .string()
      .trim()
      .min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password.',
    path: ['newPassword'],
  })

export const firstLoginSetPasswordSchema = z
  .object({
    newPassword: newPasswordRules,
    confirmNewPassword: z
      .string()
      .trim()
      .min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmNewPassword'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
export type FirstLoginSetPasswordFormValues = z.infer<typeof firstLoginSetPasswordSchema>
