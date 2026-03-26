export interface Department {
  id: string
  nom: string
  code: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ListDepartmentsParams {
  search?: string
}

export interface UpsertDepartmentPayload {
  nom: string
  code?: string | null
  description?: string | null
}

export const DEPARTMENT_DISPLAY_LABELS: Record<string, string> = {
  'Ressources Humaines': 'Human Resources',
  'Direction des Ressources Humaines': 'Human Resources Directorate',
  'Service Planification et Controle des Effectifs': 'Workforce Planning and Control Service',
  'Service Planification et Contrôle des Effectifs': 'Workforce Planning and Control Service',
  'Departement Informatique': 'IT Department',
  'Département Informatique': 'IT Department',
  'Departement Finance et Comptabilite': 'Finance and Accounting Department',
  'Département Finance et Comptabilité': 'Finance and Accounting Department',
  'Departement Achats et Approvisionnement': 'Procurement and Supply Department',
  'Département Achats et Approvisionnement': 'Procurement and Supply Department',
  'Departement Logistique': 'Logistics Department',
  'Département Logistique': 'Logistics Department',
  'Departement HSE': 'HSE Department',
  'Département HSE': 'HSE Department',
  'Departement Administration Generale': 'General Administration Department',
  'Département Administration Générale': 'General Administration Department',
  'Service Gestion des Carrieres': 'Career Management Service',
  'Service Gestion des Carrières': 'Career Management Service',
  'Departement Formation': 'Training Department',
  'Département Formation': 'Training Department',
  'Service Selection et Recrutement': 'Recruitment and Selection Service',
  'Service Sélection et Recrutement': 'Recruitment and Selection Service',
  'Departement Relations de Travail': 'Labour Relations Department',
  'Département Relations de Travail': 'Labour Relations Department',
}

function normalizeDepartmentLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[’`´]/g, "'")
}

const DEPARTMENT_DISPLAY_ALIAS_MAP = new Map<string, string>(
  Object.entries(DEPARTMENT_DISPLAY_LABELS).map(([key, label]) => [
    normalizeDepartmentLookupKey(key),
    label,
  ]),
)

export function getDepartmentDisplayName(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  return DEPARTMENT_DISPLAY_ALIAS_MAP.get(normalizeDepartmentLookupKey(trimmed)) ?? trimmed
}
