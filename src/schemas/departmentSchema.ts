import { z } from 'zod'

const optionalTrimmed = z.string().trim().optional()

export const departmentSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters'),
  code: optionalTrimmed,
  description: optionalTrimmed,
})

export type DepartmentFormValues = z.infer<typeof departmentSchema>

export function normalizeOptionalField(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}
