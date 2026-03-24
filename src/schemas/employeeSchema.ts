import { z } from 'zod'

import {
  EMPLOYEE_SEXE_OPTIONS,
  EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS,
  EMPLOYEE_DIPLOME_OPTIONS,
  EMPLOYEE_NATIONALITE_OPTIONS,
  EMPLOYEE_POSTE_OPTIONS,
  EMPLOYEE_REGIONAL_BRANCH_OPTIONS,
  EMPLOYEE_SITUATION_FAMILIALE_OPTIONS,
  EMPLOYEE_SPECIALITE_OPTIONS,
  EMPLOYEE_TYPE_CONTRAT_OPTIONS,
  EMPLOYEE_UNIVERSITE_OPTIONS,
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

const optionalNationalite = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_NATIONALITE_OPTIONS.includes(
        value as (typeof EMPLOYEE_NATIONALITE_OPTIONS)[number],
      ),
    'Please select a valid nationality',
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

const optionalPoste = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_POSTE_OPTIONS.includes(value as (typeof EMPLOYEE_POSTE_OPTIONS)[number]),
    'Please select a valid job title',
  )

const optionalRegionalBranch = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_REGIONAL_BRANCH_OPTIONS.includes(
        value as (typeof EMPLOYEE_REGIONAL_BRANCH_OPTIONS)[number],
      ),
    'Please select a valid regional branch',
  )

const optionalDiplome = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_DIPLOME_OPTIONS.includes(value as (typeof EMPLOYEE_DIPLOME_OPTIONS)[number]),
    'Please select a valid degree or diploma',
  )

const optionalSpecialite = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_SPECIALITE_OPTIONS.includes(
        value as (typeof EMPLOYEE_SPECIALITE_OPTIONS)[number],
      ),
    'Please select a valid specialization',
  )

const optionalUniversite = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.length === 0 ||
      EMPLOYEE_UNIVERSITE_OPTIONS.includes(
        value as (typeof EMPLOYEE_UNIVERSITE_OPTIONS)[number],
      ),
    'Please select a valid university',
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
type EmployeeQualityRefinementValues = {
  diplome?: string
  specialite?: string
  universite?: string
  dateNaissance?: string
  dateRecrutement?: string
}

const employeeBaseFields = {
  nom: requiredText('Last name'),
  prenom: requiredText('First name'),
  departementId: z.string().trim().uuid('Department is required'),
  regionalBranch: optionalRegionalBranch,
  sexe: optionalSexe,
  dateNaissance: optionalDateInput('birth date'),
  lieuNaissance: optionalText,
  nationalite: optionalNationalite,
  situationFamiliale: optionalSituationFamiliale,
  nombreEnfants: optionalNonNegativeIntegerText,
  adresse: optionalText,
  numeroSecuriteSociale: optionalText,
  diplome: optionalDiplome,
  specialite: optionalSpecialite,
  universite: optionalUniversite,
  historiquePostes: optionalText,
  observations: optionalText,
  poste: optionalPoste,
  categorieProfessionnelle: optionalCategorieProfessionnelle,
  typeContrat: optionalTypeContrat,
  dateRecrutement: optionalDateInput('hire date'),
  email: optionalEmail,
  telephone: optionalAlgerianMobileSchema,
  photoUrl: optionalUrl,
}

function parseOptionalDateInput(value?: string): Date | null {
  if (!value || value.trim().length === 0) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function applyEmployeeDataQualityRefinements<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
) {
  return schema.superRefine((values: EmployeeQualityRefinementValues, ctx) => {
    const hasDegree = Boolean(values.diplome?.trim())
    const hasSpecialization = Boolean(values.specialite?.trim())
    const hasUniversity = Boolean(values.universite?.trim())

    if ((hasSpecialization || hasUniversity) && !hasDegree) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diplome'],
        message: 'Select a degree before adding a specialization or university',
      })
    }

    const birthDate = parseOptionalDateInput(values.dateNaissance)
    const hireDate = parseOptionalDateInput(values.dateRecrutement)

    if (birthDate && hireDate) {
      if (hireDate < birthDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateRecrutement'],
          message: 'Hire date must be later than the birth date',
        })
      }

      const minimumHireDate = new Date(birthDate.getTime())
      minimumHireDate.setFullYear(minimumHireDate.getFullYear() + 16)

      if (hireDate < minimumHireDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateRecrutement'],
          message: 'Hire date must be at least 16 years after the birth date',
        })
      }
    }
  })
}

export const employeeCreateSchema = applyEmployeeDataQualityRefinements(
  z.object({
    matricule: createMatriculeSchema,
    ...employeeBaseFields,
  }),
)

export const employeeUpdateSchema = applyEmployeeDataQualityRefinements(
  z.object({
    matricule: requiredText('Employee ID'),
    ...employeeBaseFields,
  }),
)

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

export function normalizeOptionalEmail(value?: string): string | null {
  const normalized = normalizeOptional(value)
  return normalized ? normalized.toLowerCase() : null
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
