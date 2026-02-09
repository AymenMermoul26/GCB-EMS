import { z } from 'zod'

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
  telephone: optionalText,
  photoUrl: optionalUrl,
})

export type EmployeeSelfEditValues = z.infer<typeof employeeSelfEditSchema>

export function normalizeOptional(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}
