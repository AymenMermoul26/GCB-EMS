import { z } from 'zod'
import { normalizeOptional as normalizeEmployeeOptional, optionalAlgerianMobileSchema } from '@/schemas/employeeSchema'
import { EMPLOYEE_POSTE_OPTIONS } from '@/types/employee'
import type { TranslateFn } from '@/i18n/messages'

export function createEmployeeSelfEditSchema(t: TranslateFn) {
  const optionalPoste = z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value ||
        value.length === 0 ||
        EMPLOYEE_POSTE_OPTIONS.includes(value as (typeof EMPLOYEE_POSTE_OPTIONS)[number]),
      t('validation.employee.invalidJobTitle'),
    )

  const optionalEmail = z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || value.length === 0 || z.string().email().safeParse(value).success,
      t('validation.validEmail'),
    )

  const optionalUrl = z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || value.length === 0 || z.string().url().safeParse(value).success,
      t('validation.employee.invalidUrl'),
    )

  return z.object({
    poste: optionalPoste,
    email: optionalEmail,
    telephone: optionalAlgerianMobileSchema,
    photoUrl: optionalUrl,
  })
}

export const employeeSelfEditSchema = createEmployeeSelfEditSchema((key) => key)

export type EmployeeSelfEditValues = z.input<typeof employeeSelfEditSchema>

export function normalizeOptional(value?: string): string | null {
  return normalizeEmployeeOptional(value)
}
