export const EMPLOYEE_VISIBILITY_FIELD_KEYS = [
  'nom',
  'prenom',
  'poste',
  'email',
  'telephone',
  'photo_url',
  'departement',
  'matricule',
] as const

export type EmployeeVisibilityFieldKey =
  (typeof EMPLOYEE_VISIBILITY_FIELD_KEYS)[number]

export const EMPLOYEE_VISIBILITY_FIELD_LABELS: Record<
  EmployeeVisibilityFieldKey,
  string
> = {
  nom: 'Last Name',
  prenom: 'First Name',
  poste: 'Job Title',
  email: 'Email',
  telephone: 'Phone',
  photo_url: 'Photo',
  departement: 'Department',
  matricule: 'Employee ID',
}

export function isEmployeeVisibilityFieldKey(
  value: string,
): value is EmployeeVisibilityFieldKey {
  return EMPLOYEE_VISIBILITY_FIELD_KEYS.includes(value as EmployeeVisibilityFieldKey)
}

export interface EmployeeVisibility {
  id: string
  employeId: string
  fieldKey: EmployeeVisibilityFieldKey
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface UpsertEmployeeVisibilityPayload {
  employeId: string
  fieldKey: EmployeeVisibilityFieldKey
  isPublic: boolean
}
