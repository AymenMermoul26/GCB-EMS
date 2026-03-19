export type PayrollEmployeeStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

export interface PayrollEmployeeListItem {
  id: string
  departementId: string | null
  departementNom: string | null
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  typeContrat: string | null
  isActive: boolean
}

export interface PayrollEmployeeDetail {
  id: string
  departementId: string | null
  departementNom: string | null
  matricule: string
  nom: string
  prenom: string
  photoUrl: string | null
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  dateRecrutement: string | null
  email: string | null
  telephone: string | null
  sexe: string | null
  dateNaissance: string | null
  lieuNaissance: string | null
  nationalite: string | null
  situationFamiliale: string | null
  nombreEnfants: number | null
  adresse: string | null
  isActive: boolean
  numeroSecuriteSociale: string | null
}

export interface PayrollEmployeeListFilters {
  search?: string
  departementId?: string
  status?: PayrollEmployeeStatusFilter
  typeContrat?: string
}
