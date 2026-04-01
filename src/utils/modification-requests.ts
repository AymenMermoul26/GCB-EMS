import type { TranslateFn } from '@/i18n/messages'
import type { Employee, UpdateEmployeePayload } from '@/types/employee'
import {
  EMPLOYEE_DIPLOME_OPTIONS,
  EMPLOYEE_NATIONALITE_OPTIONS,
  EMPLOYEE_POSTE_OPTIONS,
  EMPLOYEE_REGIONAL_BRANCH_OPTIONS,
  EMPLOYEE_SEXE_OPTIONS,
  EMPLOYEE_SITUATION_FAMILIALE_OPTIONS,
  EMPLOYEE_SPECIALITE_OPTIONS,
  EMPLOYEE_UNIVERSITE_OPTIONS,
  getEmployeeDiplomeLabel,
  getEmployeeNationaliteLabel,
  getEmployeePosteLabel,
  getEmployeeRegionalBranchLabel,
  getEmployeeSexeLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeSpecialiteLabel,
  getEmployeeUniversiteLabel,
  sanitizeEmployeeTextValue,
} from '@/types/employee'
import {
  MODIFICATION_REQUEST_FIELD_OPTIONS,
  type ModificationRequestField,
  type ModificationRequestFieldGroup,
  type ModificationRequestFieldOption,
} from '@/types/modification-request'

interface ModificationRequestSelectOption {
  value: string
  label: string
}

interface FormatModificationRequestFieldValueOptions {
  emptyValue?: string
  locale?: string
}

export const REQUEST_FIELD_LABELS: Record<ModificationRequestField, string> = {
  poste: 'Job Title',
  email: 'Email',
  telephone: 'Phone',
  photo_url: 'Photo URL',
  nom: 'Last Name',
  prenom: 'First Name',
  regional_branch: 'Regional Branch',
  sexe: 'Sex',
  date_naissance: 'Birth Date',
  lieu_naissance: 'Birth Place',
  nationalite: 'Nationality',
  situation_familiale: 'Marital Status',
  nombre_enfants: 'Number of Children',
  adresse: 'Address',
  diplome: 'Degree',
  specialite: 'Specialization',
  universite: 'University',
  historique_postes: 'Career History',
}

export const REQUEST_FIELD_GROUP_LABELS: Record<ModificationRequestFieldGroup, string> = {
  identity: 'Identity',
  contact: 'Contact',
  personal: 'Personal Information',
  organization: 'Organization',
  education_career: 'Education & Career Background',
}

const SELECT_FIELD_OPTIONS: Partial<Record<ModificationRequestField, readonly string[]>> = {
  poste: EMPLOYEE_POSTE_OPTIONS,
  regional_branch: EMPLOYEE_REGIONAL_BRANCH_OPTIONS,
  sexe: EMPLOYEE_SEXE_OPTIONS,
  nationalite: EMPLOYEE_NATIONALITE_OPTIONS,
  situation_familiale: EMPLOYEE_SITUATION_FAMILIALE_OPTIONS,
  diplome: EMPLOYEE_DIPLOME_OPTIONS,
  specialite: EMPLOYEE_SPECIALITE_OPTIONS,
  universite: EMPLOYEE_UNIVERSITE_OPTIONS,
}

function getModificationRequestFieldOptionInternal(
  field: ModificationRequestField,
): ModificationRequestFieldOption | undefined {
  return MODIFICATION_REQUEST_FIELD_OPTIONS.find((option) => option.key === field)
}

function formatDateOnly(value: string, locale?: string): string {
  const parsed = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString(locale)
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\s+/g, '')
}

export function getModificationRequestFieldOption(
  field: ModificationRequestField,
): ModificationRequestFieldOption {
  const option = getModificationRequestFieldOptionInternal(field)

  if (!option) {
    throw new Error(`Unsupported modification request field: ${field}`)
  }

  return option
}

export function getRequestFieldGroupLabel(
  group: ModificationRequestFieldGroup,
  t?: TranslateFn,
): string {
  if (!t) {
    return REQUEST_FIELD_GROUP_LABELS[group]
  }

  const translated = t(`requests.groups.${group}`)
  return translated === `requests.groups.${group}`
    ? REQUEST_FIELD_GROUP_LABELS[group]
    : translated
}

export function getRequestFieldLabel(
  field: ModificationRequestField,
  t?: TranslateFn,
): string {
  if (!t) {
    return REQUEST_FIELD_LABELS[field]
  }

  const translated = t(`requests.fields.${field}`)
  return translated === `requests.fields.${field}`
    ? REQUEST_FIELD_LABELS[field]
    : translated
}

export function getModificationRequestFieldSelectOptions(
  field: ModificationRequestField,
): ModificationRequestSelectOption[] {
  const options = SELECT_FIELD_OPTIONS[field]

  if (!options) {
    return []
  }

  return options.map((optionValue) => {
    switch (field) {
      case 'poste':
        return {
          value: optionValue,
          label: getEmployeePosteLabel(optionValue) ?? optionValue,
        }
      case 'regional_branch':
        return {
          value: optionValue,
          label: getEmployeeRegionalBranchLabel(optionValue) ?? optionValue,
        }
      case 'sexe':
        return {
          value: optionValue,
          label: getEmployeeSexeLabel(optionValue) ?? optionValue,
        }
      case 'nationalite':
        return {
          value: optionValue,
          label: getEmployeeNationaliteLabel(optionValue) ?? optionValue,
        }
      case 'situation_familiale':
        return {
          value: optionValue,
          label: getEmployeeSituationFamilialeLabel(optionValue) ?? optionValue,
        }
      case 'diplome':
        return {
          value: optionValue,
          label: getEmployeeDiplomeLabel(optionValue) ?? optionValue,
        }
      case 'specialite':
        return {
          value: optionValue,
          label: getEmployeeSpecialiteLabel(optionValue) ?? optionValue,
        }
      case 'universite':
        return {
          value: optionValue,
          label: getEmployeeUniversiteLabel(optionValue) ?? optionValue,
        }
      default:
        return {
          value: optionValue,
          label: optionValue,
        }
    }
  })
}

export function normalizeModificationRequestValue(
  field: ModificationRequestField,
  value: string | null | undefined,
): string | null {
  const sanitized = sanitizeEmployeeTextValue(value)

  if (!sanitized) {
    return null
  }

  switch (field) {
    case 'email':
      return sanitized.toLowerCase()
    case 'telephone':
      return normalizePhoneNumber(sanitized)
    case 'nombre_enfants':
      return /^\d+$/.test(sanitized) ? String(Number.parseInt(sanitized, 10)) : sanitized
    default:
      return sanitized
  }
}

export function isModificationRequestValueValid(
  field: ModificationRequestField,
  value: string | null | undefined,
): boolean {
  const normalized = normalizeModificationRequestValue(field, value)

  if (!normalized) {
    return false
  }

  const fieldOption = getModificationRequestFieldOption(field)

  if (fieldOption.inputType === 'select') {
    return getModificationRequestFieldSelectOptions(field).some((option) => option.value === normalized)
  }

  switch (field) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    case 'telephone':
      return /^\+213[567]\d{8}$/.test(normalized)
    case 'photo_url':
      return /^https?:\/\/.+/i.test(normalized)
    case 'date_naissance':
      return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    case 'nombre_enfants':
      return /^\d+$/.test(normalized)
    default:
      return true
  }
}

export function formatModificationRequestFieldValue(
  field: ModificationRequestField,
  value: string | null | undefined,
  options: FormatModificationRequestFieldValueOptions = {},
): string {
  const emptyValue = options.emptyValue ?? '-'
  const normalized = normalizeModificationRequestValue(field, value)

  if (!normalized) {
    return emptyValue
  }

  switch (field) {
    case 'poste':
      return getEmployeePosteLabel(normalized) ?? normalized
    case 'regional_branch':
      return getEmployeeRegionalBranchLabel(normalized) ?? normalized
    case 'sexe':
      return getEmployeeSexeLabel(normalized) ?? normalized
    case 'nationalite':
      return getEmployeeNationaliteLabel(normalized) ?? normalized
    case 'situation_familiale':
      return getEmployeeSituationFamilialeLabel(normalized) ?? normalized
    case 'diplome':
      return getEmployeeDiplomeLabel(normalized) ?? normalized
    case 'specialite':
      return getEmployeeSpecialiteLabel(normalized) ?? normalized
    case 'universite':
      return getEmployeeUniversiteLabel(normalized) ?? normalized
    case 'date_naissance':
      return formatDateOnly(normalized, options.locale)
    default:
      return normalized
  }
}

export function getEmployeeFieldValue(
  employee: Employee,
  field: ModificationRequestField,
): string {
  switch (field) {
    case 'poste':
      return employee.poste ?? ''
    case 'email':
      return employee.email ?? ''
    case 'telephone':
      return employee.telephone ?? ''
    case 'photo_url':
      return employee.photoUrl ?? ''
    case 'nom':
      return employee.nom
    case 'prenom':
      return employee.prenom
    case 'regional_branch':
      return employee.regionalBranch ?? ''
    case 'sexe':
      return employee.sexe ?? ''
    case 'date_naissance':
      return employee.dateNaissance ?? ''
    case 'lieu_naissance':
      return employee.lieuNaissance ?? ''
    case 'nationalite':
      return employee.nationalite ?? ''
    case 'situation_familiale':
      return employee.situationFamiliale ?? ''
    case 'nombre_enfants':
      return employee.nombreEnfants === null || employee.nombreEnfants === undefined
        ? ''
        : String(employee.nombreEnfants)
    case 'adresse':
      return employee.adresse ?? ''
    case 'diplome':
      return employee.diplome ?? ''
    case 'specialite':
      return employee.specialite ?? ''
    case 'universite':
      return employee.universite ?? ''
    case 'historique_postes':
      return employee.historiquePostes ?? ''
    default:
      return ''
  }
}

export function toEmployeeUpdatePayload(
  field: ModificationRequestField,
  value: string,
): UpdateEmployeePayload {
  const normalizedValue = normalizeModificationRequestValue(field, value)

  switch (field) {
    case 'poste':
      return { poste: normalizedValue ?? null }
    case 'email':
      return { email: normalizedValue ?? null }
    case 'telephone':
      return { telephone: normalizedValue ?? null }
    case 'photo_url':
      return { photoUrl: normalizedValue ?? null }
    case 'nom':
      return { nom: normalizedValue ?? '' }
    case 'prenom':
      return { prenom: normalizedValue ?? '' }
    case 'regional_branch':
      return { regionalBranch: normalizedValue ?? null }
    case 'sexe':
      return { sexe: normalizedValue ?? null }
    case 'date_naissance':
      return { dateNaissance: normalizedValue ?? null }
    case 'lieu_naissance':
      return { lieuNaissance: normalizedValue ?? null }
    case 'nationalite':
      return { nationalite: normalizedValue ?? null }
    case 'situation_familiale':
      return { situationFamiliale: normalizedValue ?? null }
    case 'nombre_enfants':
      return {
        nombreEnfants:
          normalizedValue && /^\d+$/.test(normalizedValue)
            ? Number.parseInt(normalizedValue, 10)
            : null,
      }
    case 'adresse':
      return { adresse: normalizedValue ?? null }
    case 'diplome':
      return { diplome: normalizedValue ?? null }
    case 'specialite':
      return { specialite: normalizedValue ?? null }
    case 'universite':
      return { universite: normalizedValue ?? null }
    case 'historique_postes':
      return { historiquePostes: normalizedValue ?? null }
    default:
      return {}
  }
}
