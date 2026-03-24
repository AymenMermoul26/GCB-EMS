export const EMPLOYEE_SEXE_OPTIONS = ['M', 'F'] as const
export const EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS = ['Cadre', 'Agent'] as const
export const EMPLOYEE_TYPE_CONTRAT_OPTIONS = ['CDI', 'CDD'] as const
export const EMPLOYEE_NATIONALITE_OPTIONS = [
  'Algerian',
  'Tunisian',
  'Moroccan',
  'Mauritanian',
  'Libyan',
  'Egyptian',
  'French',
  'Italian',
  'Spanish',
  'Turkish',
  'Chinese',
  'Canadian',
  'Other nationality',
] as const
export const EMPLOYEE_POSTE_OPTIONS = [
  'HR Administrator',
  'HR Operations Manager',
  'Workforce Planning Analyst',
  'IT Support Engineer',
  'Financial Controller',
  'Procurement Officer',
  'Logistics Coordinator',
  'HSE Specialist',
  'Administrative Supervisor',
  'Career Development Officer',
  'Training Coordinator',
  'Recruitment Specialist',
  'Labour Relations Officer',
  'Payroll Officer',
  'Payroll Manager',
  'Accountant',
  'Administrative Assistant',
  'Department Manager',
  'Engineer',
  'Technician',
  'Team Leader',
  'Operator',
  'Analyst',
  'Other role',
] as const
export const EMPLOYEE_DIPLOME_OPTIONS = [
  'Licence',
  'Master',
  "Ingenieur d'Etat / Diplome d'ingenieur",
  'Doctorat',
  'BTS / TS',
  'Autre diplome',
] as const
export const EMPLOYEE_SPECIALITE_OPTIONS = [
  'Ressources humaines',
  'Informatique',
  'Genie logiciel',
  'Reseaux et telecommunications',
  'Finance / Comptabilite',
  'Gestion',
  'Achats / Approvisionnement',
  'Logistique',
  'HSE',
  'Droit',
  'Administration publique',
  'Formation / Ingenierie pedagogique',
  'Statistiques / Data',
  'Petrole / Gaz',
  'Geologie',
  'Maintenance industrielle',
  'Genie civil',
  'Genie mecanique',
  'Genie electrique',
  'Electrotechnique',
  'Automatisation',
  'Chimie industrielle',
  'Autre specialisation',
] as const
export const EMPLOYEE_UNIVERSITE_OPTIONS = [
  'USTHB',
  "Universite d'Alger 1",
  "Universite d'Alger 2",
  "Universite d'Alger 3",
  'Universite Mhamed Bougara de Boumerdes',
  'Universite Saad Dahlab de Blida',
  "Universite d'Oran 1 Ahmed Ben Bella",
  "Universite des Sciences et de la Technologie d'Oran Mohamed Boudiaf",
  'Universite Freres Mentouri Constantine 1',
  'Universite Mohamed Khider de Biskra',
  'Universite de Bejaia',
  'Universite Mouloud Mammeri de Tizi Ouzou',
  'Universite Abou Bekr Belkaid de Tlemcen',
  'Universite Kasdi Merbah Ouargla',
  "Universite d'Adrar Ahmed Draia",
  "Centre universitaire d'In Salah",
  'Autre etablissement algerien',
] as const
export const EMPLOYEE_REGIONAL_BRANCH_OPTIONS = [
  'Alger (El Harrach, Oued Smar)',
  'Boumerd\u00e8s',
  'Arzew',
  'Hassi Messaoud',
  'Hassi R\u2019Mel',
  'In Salah',
  'Adrar',
  'In Amenas',
] as const
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
export type EmployeeNationalite = (typeof EMPLOYEE_NATIONALITE_OPTIONS)[number]
export type EmployeePoste = (typeof EMPLOYEE_POSTE_OPTIONS)[number]
export type EmployeeDiplome = (typeof EMPLOYEE_DIPLOME_OPTIONS)[number]
export type EmployeeSpecialite = (typeof EMPLOYEE_SPECIALITE_OPTIONS)[number]
export type EmployeeUniversite = (typeof EMPLOYEE_UNIVERSITE_OPTIONS)[number]
export type EmployeeRegionalBranch = (typeof EMPLOYEE_REGIONAL_BRANCH_OPTIONS)[number]
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

export const EMPLOYEE_NATIONALITE_LABELS: Record<EmployeeNationalite, string> = {
  Algerian: 'Algerian',
  Tunisian: 'Tunisian',
  Moroccan: 'Moroccan',
  Mauritanian: 'Mauritanian',
  Libyan: 'Libyan',
  Egyptian: 'Egyptian',
  French: 'French',
  Italian: 'Italian',
  Spanish: 'Spanish',
  Turkish: 'Turkish',
  Chinese: 'Chinese',
  Canadian: 'Canadian',
  'Other nationality': 'Other nationality',
}

export const EMPLOYEE_POSTE_LABELS: Record<EmployeePoste, string> = {
  'HR Administrator': 'HR Administrator',
  'HR Operations Manager': 'HR Operations Manager',
  'Workforce Planning Analyst': 'Workforce Planning Analyst',
  'IT Support Engineer': 'IT Support Engineer',
  'Financial Controller': 'Financial Controller',
  'Procurement Officer': 'Procurement Officer',
  'Logistics Coordinator': 'Logistics Coordinator',
  'HSE Specialist': 'HSE Specialist',
  'Administrative Supervisor': 'Administrative Supervisor',
  'Career Development Officer': 'Career Development Officer',
  'Training Coordinator': 'Training Coordinator',
  'Recruitment Specialist': 'Recruitment Specialist',
  'Labour Relations Officer': 'Labour Relations Officer',
  'Payroll Officer': 'Payroll Officer',
  'Payroll Manager': 'Payroll Manager',
  Accountant: 'Accountant',
  'Administrative Assistant': 'Administrative Assistant',
  'Department Manager': 'Department Manager',
  Engineer: 'Engineer',
  Technician: 'Technician',
  'Team Leader': 'Team Leader',
  Operator: 'Operator',
  Analyst: 'Analyst',
  'Other role': 'Other role',
}

export const EMPLOYEE_DIPLOME_LABELS: Record<EmployeeDiplome, string> = {
  Licence: 'Licence',
  Master: 'Master',
  "Ingenieur d'Etat / Diplome d'ingenieur": "Ing\u00e9nieur d'\u00c9tat / Dipl\u00f4me d'ing\u00e9nieur",
  Doctorat: 'Doctorat',
  'BTS / TS': 'BTS / TS',
  'Autre diplome': 'Autre dipl\u00f4me',
}

export const EMPLOYEE_SPECIALITE_LABELS: Record<EmployeeSpecialite, string> = {
  'Ressources humaines': 'Ressources humaines',
  Informatique: 'Informatique',
  'Genie logiciel': 'G\u00e9nie logiciel',
  'Reseaux et telecommunications': 'R\u00e9seaux et t\u00e9l\u00e9communications',
  'Finance / Comptabilite': 'Finance / Comptabilit\u00e9',
  Gestion: 'Gestion',
  'Achats / Approvisionnement': 'Achats / Approvisionnement',
  Logistique: 'Logistique',
  HSE: 'HSE',
  Droit: 'Droit',
  'Administration publique': 'Administration publique',
  'Formation / Ingenierie pedagogique': 'Formation / Ing\u00e9nierie p\u00e9dagogique',
  'Statistiques / Data': 'Statistiques / Data',
  'Petrole / Gaz': 'P\u00e9trole / Gaz',
  Geologie: 'G\u00e9ologie',
  'Maintenance industrielle': 'Maintenance industrielle',
  'Genie civil': 'G\u00e9nie civil',
  'Genie mecanique': 'G\u00e9nie m\u00e9canique',
  'Genie electrique': 'G\u00e9nie \u00e9lectrique',
  Electrotechnique: '\u00c9lectrotechnique',
  Automatisation: 'Automatisation',
  'Chimie industrielle': 'Chimie industrielle',
  'Autre specialisation': 'Autre sp\u00e9cialisation',
}

export const EMPLOYEE_UNIVERSITE_LABELS: Record<EmployeeUniversite, string> = {
  USTHB: 'USTHB',
  "Universite d'Alger 1": "Universit\u00e9 d'Alger 1",
  "Universite d'Alger 2": "Universit\u00e9 d'Alger 2",
  "Universite d'Alger 3": "Universit\u00e9 d'Alger 3",
  'Universite Mhamed Bougara de Boumerdes': "Universit\u00e9 M'Hamed Bougara de Boumerd\u00e8s",
  'Universite Saad Dahlab de Blida': 'Universit\u00e9 Saad Dahlab de Blida',
  "Universite d'Oran 1 Ahmed Ben Bella": "Universit\u00e9 d'Oran 1 Ahmed Ben Bella",
  "Universite des Sciences et de la Technologie d'Oran Mohamed Boudiaf":
    "Universit\u00e9 des Sciences et de la Technologie d'Oran Mohamed Boudiaf",
  'Universite Freres Mentouri Constantine 1': 'Universit\u00e9 Fr\u00e8res Mentouri Constantine 1',
  'Universite Mohamed Khider de Biskra': 'Universit\u00e9 Mohamed Khider de Biskra',
  'Universite de Bejaia': 'Universit\u00e9 de B\u00e9ja\u00efa',
  'Universite Mouloud Mammeri de Tizi Ouzou': 'Universit\u00e9 Mouloud Mammeri de Tizi Ouzou',
  'Universite Abou Bekr Belkaid de Tlemcen': 'Universit\u00e9 Abou Bekr Belkaid de Tlemcen',
  'Universite Kasdi Merbah Ouargla': 'Universit\u00e9 Kasdi Merbah Ouargla',
  "Universite d'Adrar Ahmed Draia": "Universit\u00e9 d'Adrar Ahmed Draia",
  "Centre universitaire d'In Salah": "Centre universitaire d'In Salah",
  'Autre etablissement algerien': 'Autre \u00e9tablissement alg\u00e9rien',
}

export const EMPLOYEE_REGIONAL_BRANCH_LABELS: Record<EmployeeRegionalBranch, string> = {
  'Alger (El Harrach, Oued Smar)': 'Alger (El Harrach, Oued Smar)',
  'Boumerd\u00e8s': 'Boumerd\u00e8s',
  Arzew: 'Arzew',
  'Hassi Messaoud': 'Hassi Messaoud',
  'Hassi R\u2019Mel': 'Hassi R\u2019Mel',
  'In Salah': 'In Salah',
  Adrar: 'Adrar',
  'In Amenas': 'In Amenas',
}

export const EMPLOYEE_SITUATION_FAMILIALE_LABELS: Record<
  EmployeeSituationFamiliale,
  string
> = {
  'C\u00e9libataire': 'Single',
  'Mari\u00e9(e)': 'Married',
  'Divorc\u00e9(e)': 'Divorced',
  'Veuf(ve)': 'Widowed',
}

const EMPLOYEE_SEXE_ALIASES: Partial<Record<string, EmployeeSexe>> = {
  m: 'M',
  male: 'M',
  masculin: 'M',
  homme: 'M',
  f: 'F',
  female: 'F',
  feminin: 'F',
  feminine: 'F',
  femme: 'F',
}

const EMPLOYEE_CATEGORIE_PROFESSIONNELLE_ALIASES: Partial<
  Record<string, EmployeeCategorieProfessionnelle>
> = {
  cadre: 'Cadre',
  executive: 'Cadre',
  agent: 'Agent',
}

const EMPLOYEE_TYPE_CONTRAT_ALIASES: Partial<Record<string, EmployeeTypeContrat>> = {
  cdi: 'CDI',
  permanent: 'CDI',
  cdd: 'CDD',
  'fixed-term': 'CDD',
  'fixed term': 'CDD',
}

const EMPLOYEE_REGIONAL_BRANCH_ALIASES: Partial<Record<string, EmployeeRegionalBranch>> = {
  'alger (el harrach, oued smar)': 'Alger (El Harrach, Oued Smar)',
  alger: 'Alger (El Harrach, Oued Smar)',
  boumerdes: 'Boumerd\u00e8s',
  'boumerd\u00e8s': 'Boumerd\u00e8s',
  'boumerdã¨s': 'Boumerd\u00e8s',
  arzew: 'Arzew',
  'hassi messaoud': 'Hassi Messaoud',
  "hassi r'mel": 'Hassi R\u2019Mel',
  'hassi r\u2019mel': 'Hassi R\u2019Mel',
  'hassi râ€™mel': 'Hassi R\u2019Mel',
  'in salah': 'In Salah',
  adrar: 'Adrar',
  'in amenas': 'In Amenas',
}

const EMPLOYEE_SITUATION_FAMILIALE_ALIASES: Partial<
  Record<string, EmployeeSituationFamiliale>
> = {
  'c\u00e9libataire': 'C\u00e9libataire',
  celibataire: 'C\u00e9libataire',
  'cã©libataire': 'C\u00e9libataire',
  'mari\u00e9(e)': 'Mari\u00e9(e)',
  'marie(e)': 'Mari\u00e9(e)',
  'mariã©(e)': 'Mari\u00e9(e)',
  'divorc\u00e9(e)': 'Divorc\u00e9(e)',
  'divorce(e)': 'Divorc\u00e9(e)',
  'divorcã©(e)': 'Divorc\u00e9(e)',
  'veuf(ve)': 'Veuf(ve)',
  veuf: 'Veuf(ve)',
  veuve: 'Veuf(ve)',
  widowed: 'Veuf(ve)',
}

function normalizeEmployeeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’`´]/g, "'")
}

function resolveEmployeeLookupValue<T extends string>(
  value: string,
  aliases?: Partial<Record<string, T>>,
): string {
  const trimmed = value.trim()

  if (!aliases) {
    return trimmed
  }

  const alias = aliases[normalizeEmployeeLookupKey(trimmed)]
  return alias ?? trimmed
}

function getEmployeeLabel<T extends string>(
  value: string | null | undefined,
  labels: Partial<Record<T, string>>,
  aliases?: Partial<Record<string, T>>,
): string | null {
  if (!value) {
    return null
  }

  const resolvedValue = resolveEmployeeLookupValue(value, aliases)
  return labels[resolvedValue as T] ?? resolvedValue
}

export function getEmployeeSexeLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeSexe>(value, EMPLOYEE_SEXE_LABELS, EMPLOYEE_SEXE_ALIASES)
}

export function getEmployeeCategorieProfessionnelleLabel(
  value: string | null | undefined,
): string | null {
  return getEmployeeLabel<EmployeeCategorieProfessionnelle>(
    value,
    EMPLOYEE_CATEGORIE_PROFESSIONNELLE_LABELS,
    EMPLOYEE_CATEGORIE_PROFESSIONNELLE_ALIASES,
  )
}

export function getEmployeeTypeContratLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeTypeContrat>(
    value,
    EMPLOYEE_TYPE_CONTRAT_LABELS,
    EMPLOYEE_TYPE_CONTRAT_ALIASES,
  )
}

export function getEmployeeNationaliteLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeNationalite>(value, EMPLOYEE_NATIONALITE_LABELS)
}

export function getEmployeePosteLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeePoste>(value, EMPLOYEE_POSTE_LABELS)
}

export function getEmployeeDiplomeLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeDiplome>(value, EMPLOYEE_DIPLOME_LABELS)
}

export function getEmployeeSpecialiteLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeSpecialite>(value, EMPLOYEE_SPECIALITE_LABELS)
}

export function getEmployeeUniversiteLabel(value: string | null | undefined): string | null {
  return getEmployeeLabel<EmployeeUniversite>(value, EMPLOYEE_UNIVERSITE_LABELS)
}

export function getEmployeeRegionalBranchLabel(
  value: string | null | undefined,
): string | null {
  return getEmployeeLabel<EmployeeRegionalBranch>(
    value,
    EMPLOYEE_REGIONAL_BRANCH_LABELS,
    EMPLOYEE_REGIONAL_BRANCH_ALIASES,
  )
}

export function getEmployeeSituationFamilialeLabel(
  value: string | null | undefined,
): string | null {
  return getEmployeeLabel<EmployeeSituationFamiliale>(
    value,
    EMPLOYEE_SITUATION_FAMILIALE_LABELS,
    EMPLOYEE_SITUATION_FAMILIALE_ALIASES,
  )
}

export interface Employee {
  id: string
  departementId: string
  regionalBranch: string | null
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
  diplome: string | null
  specialite: string | null
  universite: string | null
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
  numeroSecuriteSociale: string | null
  observations: string | null
}

export interface EmployeeSortOption {
  field: 'nom' | 'prenom' | 'matricule' | 'created_at' | 'updated_at'
  direction: 'asc' | 'desc'
}

export interface EmployeesListParams {
  search?: string
  departementId?: string
  regionalBranch?: string
  nationalite?: string
  poste?: string
  diplome?: string
  specialite?: string
  universite?: string
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
  regionalBranch?: string | null
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
  universite?: string | null
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

