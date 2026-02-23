import { z } from 'zod'
import { normalizeOptional as normalizeEmployeeOptional, optionalAlgerianMobileSchema } from '@/schemas/employeeSchema'

const optionalText = z.string().trim().optional()

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || value.length === 0 || z.string().email().safeParse(value).success,
    'Please enter a valid email address',
  )

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || value.length === 0 || z.string().url().safeParse(value).success,
    'Please enter a valid URL',
  )

export const employeeSelfEditSchema = z.object({
  poste: optionalText,
  email: optionalEmail,
  telephone: optionalAlgerianMobileSchema,
  photoUrl: optionalUrl,
})

export type EmployeeSelfEditValues = z.input<typeof employeeSelfEditSchema>

export function normalizeOptional(value?: string): string | null {
  return normalizeEmployeeOptional(value)
}
