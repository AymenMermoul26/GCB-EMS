import { z } from 'zod'

const requiredText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)

const optionalText = z.string().trim().optional()

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value || value.length === 0 || z.string().email().safeParse(value).success,
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

export const employeeSchema = z.object({
  matricule: requiredText('Matricule'),
  nom: requiredText('Nom'),
  prenom: requiredText('Prenom'),
  departementId: z.string().uuid('Department is required'),
  poste: optionalText,
  email: optionalEmail,
  telephone: optionalText,
  photoUrl: optionalUrl,
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>

export function normalizeOptional(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}
