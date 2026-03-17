import { z } from 'zod'

import {
  EMPLOYEE_SEXE_OPTIONS,
  EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS,
  EMPLOYEE_SITUATION_FAMILIALE_OPTIONS,
  EMPLOYEE_TYPE_CONTRAT_OPTIONS,
} from '@/types/employee'

const requiredText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)

const optionalText = z.string().trim().optional()

const optionalDateInput = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
      `Please enter a valid ${label}`,
    )

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

const optionalSexe = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_SEXE_OPTIONS.includes(value as (typeof EMPLOYEE_SEXE_OPTIONS)[number]),
    'Please select a valid sex value',
  )

const optionalSituationFamiliale = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_SITUATION_FAMILIALE_OPTIONS.includes(
        value as (typeof EMPLOYEE_SITUATION_FAMILIALE_OPTIONS)[number],
      ),
    'Please select a valid marital status',
  )

const optionalNonNegativeIntegerText = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || value.length === 0 || /^\d+$/.test(value),
    'Please enter a valid whole number',
  )

const optionalCategorieProfessionnelle = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS.includes(
        value as (typeof EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS)[number],
      ),
    'Please select a valid professional category',
  )

const optionalTypeContrat = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_TYPE_CONTRAT_OPTIONS.includes(
        value as (typeof EMPLOYEE_TYPE_CONTRAT_OPTIONS)[number],
      ),
    'Please select a valid contract type',
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
  nom: requiredText('Last name'),
  prenom: requiredText('First name'),
  departementId: z.string().uuid('Le d?partement is required'),
  sexe: optionalSexe,
  dateNaissance: optionalDateInput('birth date'),
  lieuNaissance: optionalText,
  nationalite: optionalText,
  situationFamiliale: optionalSituationFamiliale,
  nombreEnfants: optionalNonNegativeIntegerText,
  adresse: optionalText,
  numeroSecuriteSociale: optionalText,
  diplome: optionalText,
  specialite: optionalText,
  historiquePostes: optionalText,
  observations: optionalText,
  poste: optionalText,
  categorieProfessionnelle: optionalCategorieProfessionnelle,
  typeContrat: optionalTypeContrat,
  dateRecrutement: optionalDateInput('hire date'),
  email: optionalEmail,
  telephone: optionalAlgerianMobileSchema,
  photoUrl: optionalUrl,
}

export const employeeCreateSchema = z.object({
  matricule: createMatriculeSchema,
  ...employeeBaseFields,
})

export const employeeUpdateSchema = z.object({
  matricule: requiredText('Employee ID'),
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

export function normalizeOptionalInteger(value?: string): number | null {
  const trimmed = value?.trim()

  if (!trimmed || trimmed.length === 0) {
    return null
  }

  if (!/^\d+$/.test(trimmed)) {
    return null
  }

  return Number.parseInt(trimmed, 10)
}
