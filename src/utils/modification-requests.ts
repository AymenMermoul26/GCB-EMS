import type { Employee, UpdateEmployeePayload } from '@/types/employee'
import type { ModificationRequestField } from '@/types/modification-request'

export const REQUEST_FIELD_LABELS: Record<ModificationRequestField, string> = {
  poste: 'Poste',
  email: 'Email',
  telephone: 'Telephone',
  photo_url: 'Photo URL',
  nom: 'Nom',
  prenom: 'Prenom',
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
    default:
      return ''
  }
}

export function toEmployeeUpdatePayload(
  field: ModificationRequestField,
  value: string,
): UpdateEmployeePayload {
  const normalizedValue = value.trim()

  switch (field) {
    case 'poste':
      return { poste: normalizedValue || null }
    case 'email':
      return { email: normalizedValue || null }
    case 'telephone':
      return { telephone: normalizedValue || null }
    case 'photo_url':
      return { photoUrl: normalizedValue || null }
    case 'nom':
      return { nom: normalizedValue }
    case 'prenom':
      return { prenom: normalizedValue }
    default:
      return {}
  }
}
