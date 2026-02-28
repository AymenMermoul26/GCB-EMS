import { z } from 'zod'

const requiredText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)

const optionalText = z.string().trim().optional()

export const algerianMobileRegex = /^\+213[567]\d{8}$/
export const algerianMobileErrorMessage =
  'Phone number must start with +213 followed by 5, 6, or 7 and 8 digits'

export function normalizePhoneNumberInput(value?: string): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  return value.trim().replace(/\s+/g, '')
}

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

export const optionalAlgerianMobileSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => {
    if (!value || value.length === 0) {
      return true
    }

    const normalized = normalizePhoneNumberInput(value)
    if (!normalized) {
      return false
    }

    return algerianMobileRegex.test(normalized)
  }, algerianMobileErrorMessage)

const createMatriculeSchema = z.string().trim().optional()

const employeeBaseFields = {
  nom: requiredText('Nom'),
  prenom: requiredText('Prenom'),
  departementId: z.string().uuid('Department is required'),
  poste: optionalText,
  email: optionalEmail,
  telephone: optionalAlgerianMobileSchema,
  photoUrl: optionalUrl,
}

export const employeeCreateSchema = z.object({
  matricule: createMatriculeSchema,
  ...employeeBaseFields,
})

export const employeeUpdateSchema = z.object({
  matricule: requiredText('Matricule'),
  ...employeeBaseFields,
})

export const employeeSchema = employeeUpdateSchema

export type EmployeeCreateFormValues = z.input<typeof employeeCreateSchema>
export type EmployeeUpdateFormValues = z.input<typeof employeeUpdateSchema>
export type EmployeeFormValues = EmployeeUpdateFormValues

export function normalizeOptional(value?: string): string | null {
  const trimmed = value?.trim()

  if (!trimmed || trimmed.length === 0) {
    return null
  }

  const compact = trimmed.replace(/\s+/g, '')
  if (algerianMobileRegex.test(compact)) {
    return compact
  }

  return trimmed
}
