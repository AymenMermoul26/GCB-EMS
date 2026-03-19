export const EMPLOYEE_SEXE_OPTIONS = ['M', 'F'] as const
export const EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS = ['Cadre', 'Agent'] as const
export const EMPLOYEE_TYPE_CONTRAT_OPTIONS = ['CDI', 'CDD'] as const
export const EMPLOYEE_SITUATION_FAMILIALE_OPTIONS = [
  'C\u00e9libataire',
  'Mari\u00e9(e)',
  'Divorc\u00e9(e)',
  'Veuf(ve)',
] as const

export type EmployeeSexe = (typeof EMPLOYEE_SEXE_OPTIONS)[number]
export type EmployeeCategorieProfessionnelle =
  (typeof EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS)[number]
export type EmployeeTypeContrat = (typeof EMPLOYEE_TYPE_CONTRAT_OPTIONS)[number]
export type EmployeeSituationFamiliale =
  (typeof EMPLOYEE_SITUATION_FAMILIALE_OPTIONS)[number]

export const EMPLOYEE_SEXE_LABELS: Record<EmployeeSexe, string> = {
  M: 'Male',
  F: 'Female',
}

export const EMPLOYEE_CATEGORIE_PROFESSIONNELLE_LABELS: Record<
  EmployeeCategorieProfessionnelle,
  string
> = {
  Cadre: 'Executive',
  Agent: 'Agent',
}

export const EMPLOYEE_TYPE_CONTRAT_LABELS: Record<EmployeeTypeContrat, string> = {
  CDI: 'Permanent (CDI)',
  CDD: 'Fixed-term (CDD)',
}

export const EMPLOYEE_SITUATION_FAMILIALE_LABELS: Record<string, string> = {
  'C\u00e9libataire': 'Single',
  'CÃ©libataire': 'Single',
  'Mari\u00e9(e)': 'Married',
  'MariÃ©(e)': 'Married',
  'Divorc\u00e9(e)': 'Divorced',
  'DivorcÃ©(e)': 'Divorced',
  'Veuf(ve)': 'Widowed',
}

function getEmployeeLabel<T extends string>(
  value: string | null | undefined,
  labels: Partial<Record<T, string>>,
): string | null {
  if (!value) {
    return null
  }

  return labels[value as T] ?? value
}

export function getEmployeeSexeLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeSexe>(value, EMPLOYEE_SEXE_LABELS)
}

export function getEmployeeCategorieProfessionnelleLabel(
  value: string | null | undefined,
): string | null {
  return getEmployeeLabel<EmployeeCategorieProfessionnelle>(
    value,
    EMPLOYEE_CATEGORIE_PROFESSIONNELLE_LABELS,
  )
}

export function getEmployeeTypeContratLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeTypeContrat>(value, EMPLOYEE_TYPE_CONTRAT_LABELS)
}

export function getEmployeeSituationFamilialeLabel(
  value: string | null | undefined,
): string | null {
  return getEmployeeLabel<EmployeeSituationFamiliale>(
    value,
    EMPLOYEE_SITUATION_FAMILIALE_LABELS,
  )
}

export interface Employee {
  id: string
  departementId: string
  matricule: string
  nom: string
  prenom: string
  sexe: string | null
  dateNaissance: string | null
  lieuNaissance: string | null
  nationalite: string | null
  situationFamiliale: string | null
  nombreEnfants: number | null
  adresse: string | null
  numeroSecuriteSociale: string | null
  diplome: string | null
  specialite: string | null
  historiquePostes: string | null
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  dateRecrutement: string | null
  email: string | null
  telephone: string | null
  photoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminEmployee extends Employee {
  observations: string | null
}

export interface EmployeeSortOption {
  field: 'nom' | 'prenom' | 'matricule' | 'created_at' | 'updated_at'
  direction: 'asc' | 'desc'
}

export interface EmployeesListParams {
  search?: string
  departementId?: string
  isActive?: boolean
  page?: number
  pageSize?: number
  sort?: EmployeeSortOption
}

export interface EmployeesListResponse {
  data: Employee[]
  items: Employee[]
  total: number
  page: number
  pageSize: number
}

export interface CreateEmployeePayload {
  departementId: string
  matricule?: string | null
  nom: string
  prenom: string
  sexe?: string | null
  dateNaissance?: string | null
  lieuNaissance?: string | null
  nationalite?: string | null
  situationFamiliale?: string | null
  nombreEnfants?: number | null
  adresse?: string | null
  numeroSecuriteSociale?: string | null
  diplome?: string | null
  specialite?: string | null
  historiquePostes?: string | null
  observations?: string | null
  poste?: string | null
  categorieProfessionnelle?: string | null
  typeContrat?: string | null
  dateRecrutement?: string | null
  email?: string | null
  telephone?: string | null
  photoUrl?: string | null
  isActive?: boolean
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>

