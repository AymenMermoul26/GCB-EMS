import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const DEMO_PASSWORD = 'GcbEmployee2026!'
const DEFAULT_ADMIN_EMAIL = 'hrAdmin@gcb.com'
const DEFAULT_ADMIN_PASSWORD = 'hradmingcb2026'
const ENFORCE_FIRST_LOGIN_PASSWORD_CHANGE = true
const SECURITY_NOTIFICATION_TITLE = 'Security'
const SECURITY_NOTIFICATION_BODY = 'Welcome! Please change your password to a strong one.'
const SECURITY_NOTIFICATION_LINK = '/employee/security'

const DEPARTMENTS = [
  {
    nom: 'Direction des Ressources Humaines',
    code: 'DRH',
    description: 'Corporate HR leadership and governance.',
  },
  {
    nom: 'Service Planification et Contr\u00F4le des Effectifs',
    code: 'SPCE',
    description: 'Headcount planning, workforce controls, and staffing analysis.',
  },
  {
    nom: 'D\u00E9partement Informatique',
    code: 'IT',
    description: 'Information systems, applications, infrastructure, and user support.',
  },
  {
    nom: 'D\u00E9partement Finance et Comptabilit\u00E9',
    code: 'FIN',
    description: 'Financial control, accounting operations, and reporting.',
  },
  {
    nom: 'D\u00E9partement Achats et Approvisionnement',
    code: 'DAA',
    description: 'Purchasing, sourcing, supplier management, and procurement operations.',
  },
  {
    nom: 'D\u00E9partement Logistique',
    code: 'LOG',
    description: 'Transport, warehousing, stock coordination, and field logistics.',
  },
  {
    nom: 'D\u00E9partement HSE',
    code: 'HSE',
    description: 'Health, safety, environment, and prevention management.',
  },
  {
    nom: 'D\u00E9partement Administration G\u00E9n\u00E9rale',
    code: 'DAG',
    description: 'General administration, facilities, and support services.',
  },
  {
    nom: 'Service Gestion des Carri\u00E8res',
    code: 'SGC',
    description: 'Career path management, promotions, and mobility planning.',
  },
  {
    nom: 'D\u00E9partement Formation',
    code: 'DFORM',
    description: 'Training governance, annual training plans, and learning oversight.',
  },
  {
    nom: 'Service S\u00E9lection et Recrutement',
    code: 'SSR',
    description: 'Recruitment campaigns, candidate selection, and onboarding coordination.',
  },
  {
    nom: 'D\u00E9partement Relations de Travail',
    code: 'DRT',
    description: 'Labor relations, social dialogue, and compliance support.',
  },
]

const DEMO_EMPLOYEES = [
  {
    firstName: 'Yacine',
    lastName: 'Bensaid',
    poste: 'HR Operations Manager',
    email: 'yacine.bensaid@gcb.com',
    telephone: '+213612345601',
    department: 'Direction des Ressources Humaines',
    regionalBranch: 'Alger (El Harrach, Oued Smar)',
    sexe: 'M',
    dateNaissance: '1986-04-12',
    lieuNaissance: 'Alger',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 2,
    adresse: 'Cite El Badr, Kouba, Alger',
    numeroSecuriteSociale: '186041200000001',
    diplome: 'Master',
    specialite: 'Ressources humaines',
    universite: "Universite d'Alger 3",
    historiquePostes:
      'HR Generalist -> HR Business Partner -> HR Operations Manager',
    observations:
      'Leads core HR operations and headcount reviews for central HR governance.',
    categorieProfessionnelle: 'Cadre',
    typeContrat: 'CDI',
    dateRecrutement: '2012-09-17',
    photoColor: '#EA580C',
  },
  {
    firstName: 'Amine',
    lastName: 'Kherfi',
    poste: 'Workforce Planning Analyst',
    email: 'amine.kherfi@gcb.com',
    telephone: '+213612345602',
    department: 'Service Planification et Contr\u00F4le des Effectifs',
    regionalBranch: 'Boumerdès',
    sexe: 'M',
    dateNaissance: '1990-11-03',
    lieuNaissance: 'Setif',
    nationalite: 'Algerian',
    situationFamiliale: 'Célibataire',
    nombreEnfants: 0,
    adresse: 'Cite des 1014 Logements, Setif',
    numeroSecuriteSociale: '190110300000002',
    diplome: 'Master',
    specialite: 'Statistiques / Data',
    universite: 'Universite Mhamed Bougara de Boumerdes',
    historiquePostes: 'HR Reporting Assistant -> Workforce Planning Analyst',
    observations:
      'Supports workforce planning dashboards and staffing analysis for reporting cycles.',
    categorieProfessionnelle: 'Agent',
    typeContrat: 'CDI',
    dateRecrutement: '2017-02-06',
    photoColor: '#2563EB',
  },
  {
    firstName: 'Sara',
    lastName: 'Meziane',
    poste: 'IT Support Engineer',
    email: 'sara.meziane@gcb.com',
    telephone: '+213612345603',
    department: 'D\u00E9partement Informatique',
    regionalBranch: 'Arzew',
    sexe: 'F',
    dateNaissance: '1992-02-21',
    lieuNaissance: 'Oran',
    nationalite: 'Algerian',
    situationFamiliale: 'Célibataire',
    nombreEnfants: 0,
    adresse: 'Hai El Yasmine, Es Senia, Oran',
    numeroSecuriteSociale: '292022100000003',
    diplome: "Ingenieur d'Etat / Diplome d'ingenieur",
    specialite: 'Informatique',
    universite: "Universite des Sciences et de la Technologie d'Oran Mohamed Boudiaf",
    historiquePostes: 'IT Helpdesk Technician -> IT Support Engineer',
    observations:
      'Handles user support coordination and workstation readiness for field teams.',
    categorieProfessionnelle: 'Agent',
    typeContrat: 'CDI',
    dateRecrutement: '2018-03-12',
    photoColor: '#0891B2',
  },
  {
    firstName: 'Lina',
    lastName: 'Boudiaf',
    poste: 'Financial Controller',
    email: 'payrollagent@gcb.com',
    telephone: '+213612345604',
    department: 'D\u00E9partement Finance et Comptabilit\u00E9',
    regionalBranch: 'Hassi Messaoud',
    sexe: 'F',
    dateNaissance: '1988-07-14',
    lieuNaissance: 'Constantine',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 1,
    adresse: 'Rue Kitouni Abdelmalek, Constantine',
    numeroSecuriteSociale: '288071400000004',
    diplome: 'Master',
    specialite: 'Finance / Comptabilite',
    universite: 'Universite Freres Mentouri Constantine 1',
    historiquePostes: 'Accountant -> Senior Accountant -> Financial Controller',
    observations:
      'Owns payroll controls, reconciliations, and monthly financial reporting support.',
    categorieProfessionnelle: 'Cadre',
    typeContrat: 'CDI',
    dateRecrutement: '2014-06-02',
    photoColor: '#7C3AED',
  },
  {
    firstName: 'Walid',
    lastName: 'Cheriet',
    poste: 'Procurement Officer',
    email: 'walid.cheriet@gcb.com',
    telephone: '+213612345605',
    department: 'D\u00E9partement Achats et Approvisionnement',
    regionalBranch: 'Hassi R’Mel',
    sexe: 'M',
    dateNaissance: '1987-09-28',
    lieuNaissance: 'Annaba',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 3,
    adresse: 'Cite Seybouse, Annaba',
    numeroSecuriteSociale: '187092800000005',
    diplome: 'Licence',
    specialite: 'Achats / Approvisionnement',
    universite: "Universite d'Oran 1 Ahmed Ben Bella",
    historiquePostes: 'Buyer Assistant -> Procurement Officer',
    observations:
      'Coordinates supplier follow-up and procurement file preparation for operational needs.',
    categorieProfessionnelle: 'Agent',
    typeContrat: 'CDI',
    dateRecrutement: '2015-11-09',
    photoColor: '#475569',
  },
  {
    firstName: 'Ilyes',
    lastName: 'Ferhat',
    poste: 'Logistics Coordinator',
    email: 'ilyes.ferhat@gcb.com',
    telephone: '+213612345606',
    department: 'D\u00E9partement Logistique',
    regionalBranch: 'In Salah',
    sexe: 'M',
    dateNaissance: '1991-01-19',
    lieuNaissance: 'Blida',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 1,
    adresse: 'Ouled Yaich, Blida',
    numeroSecuriteSociale: '191011900000006',
    diplome: 'Licence',
    specialite: 'Logistique',
    universite: 'Universite Saad Dahlab de Blida',
    historiquePostes: 'Warehouse Agent -> Logistics Coordinator',
    observations:
      'Supports stock movement planning and logistics coordination for regional sites.',
    categorieProfessionnelle: 'Agent',
    typeContrat: 'CDD',
    dateRecrutement: '2021-04-18',
    photoColor: '#0F766E',
  },
  {
    firstName: 'Ines',
    lastName: 'Rahmani',
    poste: 'HSE Specialist',
    email: 'ines.rahmani@gcb.com',
    telephone: '+213612345607',
    department: 'D\u00E9partement HSE',
    regionalBranch: 'Adrar',
    sexe: 'F',
    dateNaissance: '1993-05-08',
    lieuNaissance: 'Tlemcen',
    nationalite: 'Algerian',
    situationFamiliale: 'Célibataire',
    nombreEnfants: 0,
    adresse: 'Chetouane, Tlemcen',
    numeroSecuriteSociale: '293050800000007',
    diplome: 'Master',
    specialite: 'HSE',
    universite: 'Universite Abou Bekr Belkaid de Tlemcen',
    historiquePostes: 'HSE Analyst -> HSE Specialist',
    observations:
      'Monitors HSE compliance actions and prevention follow-up for field operations.',
    categorieProfessionnelle: 'Cadre',
    typeContrat: 'CDI',
    dateRecrutement: '2019-01-13',
    photoColor: '#16A34A',
  },
  {
    firstName: 'Karim',
    lastName: 'Touati',
    poste: 'Administrative Supervisor',
    email: 'karim.touati@gcb.com',
    telephone: '+213612345608',
    department: 'D\u00E9partement Administration G\u00E9n\u00E9rale',
    regionalBranch: 'In Amenas',
    sexe: 'M',
    dateNaissance: '1985-12-02',
    lieuNaissance: 'Bejaia',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 2,
    adresse: 'Amizour, Bejaia',
    numeroSecuriteSociale: '185120200000008',
    diplome: 'Licence',
    specialite: 'Administration publique',
    universite: 'Universite de Bejaia',
    historiquePostes: 'Administrative Officer -> Administrative Supervisor',
    observations:
      'Supervises administrative support activities and office services coordination.',
    categorieProfessionnelle: 'Cadre',
    typeContrat: 'CDI',
    dateRecrutement: '2011-05-22',
    photoColor: '#9A3412',
  },
  {
    firstName: 'Nadia',
    lastName: 'Benali',
    poste: 'Career Development Officer',
    email: 'nadia.benali@gcb.com',
    telephone: '+213612345609',
    department: 'Service Gestion des Carri\u00E8res',
    regionalBranch: 'Boumerdès',
    sexe: 'F',
    dateNaissance: '1989-03-17',
    lieuNaissance: 'Batna',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 2,
    adresse: 'Route de Biskra, Batna',
    numeroSecuriteSociale: '289031700000009',
    diplome: 'Master',
    specialite: 'Ressources humaines',
    universite: "Universite d'Alger 2",
    historiquePostes: 'Training Officer -> Career Development Officer',
    observations:
      'Supports career path reviews, mobility tracking, and employee development follow-up.',
    categorieProfessionnelle: 'Cadre',
    typeContrat: 'CDI',
    dateRecrutement: '2016-09-04',
    photoColor: '#BE185D',
  },
  {
    firstName: 'Samir',
    lastName: 'Bouzid',
    poste: 'Training Coordinator',
    email: 'samir.bouzid@gcb.com',
    telephone: '+213612345610',
    department: 'D\u00E9partement Formation',
    regionalBranch: 'Alger (El Harrach, Oued Smar)',
    sexe: 'M',
    dateNaissance: '1990-08-30',
    lieuNaissance: 'Medea',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 1,
    adresse: 'Berrouaghia, Medea',
    numeroSecuriteSociale: '190083000000010',
    diplome: 'Master',
    specialite: 'Formation / Ingenierie pedagogique',
    universite: "Universite d'Alger 2",
    historiquePostes: 'Training Assistant -> Training Coordinator',
    observations:
      'Coordinates annual training sessions and completion tracking for employees.',
    categorieProfessionnelle: 'Agent',
    typeContrat: 'CDI',
    dateRecrutement: '2018-10-07',
    photoColor: '#1D4ED8',
  },
  {
    firstName: 'Ryma',
    lastName: 'Saadi',
    poste: 'Recruitment Specialist',
    email: 'ryma.saadi@gcb.com',
    telephone: '+213612345611',
    department: 'Service S\u00E9lection et Recrutement',
    regionalBranch: 'Arzew',
    sexe: 'F',
    dateNaissance: '1994-06-11',
    lieuNaissance: 'Tizi Ouzou',
    nationalite: 'Algerian',
    situationFamiliale: 'Célibataire',
    nombreEnfants: 0,
    adresse: 'Nouvelle Ville, Tizi Ouzou',
    numeroSecuriteSociale: '294061100000011',
    diplome: 'Master',
    specialite: 'Ressources humaines',
    universite: 'Universite Mouloud Mammeri de Tizi Ouzou',
    historiquePostes: 'Talent Acquisition Assistant -> Recruitment Specialist',
    observations:
      'Manages recruitment screening, interview scheduling, and onboarding preparation.',
    categorieProfessionnelle: 'Agent',
    typeContrat: 'CDD',
    dateRecrutement: '2022-02-14',
    photoColor: '#C2410C',
  },
  {
    firstName: 'Mourad',
    lastName: 'Hamidi',
    poste: 'Labour Relations Officer',
    email: 'mourad.hamidi@gcb.com',
    telephone: '+213612345612',
    department: 'D\u00E9partement Relations de Travail',
    regionalBranch: 'Hassi Messaoud',
    sexe: 'M',
    dateNaissance: '1986-10-24',
    lieuNaissance: 'Sidi Bel Abbes',
    nationalite: 'Algerian',
    situationFamiliale: 'Marié(e)',
    nombreEnfants: 3,
    adresse: 'Sidi Djillali, Sidi Bel Abbes',
    numeroSecuriteSociale: '186102400000012',
    diplome: 'Master',
    specialite: 'Droit',
    universite: 'Universite Abou Bekr Belkaid de Tlemcen',
    historiquePostes: 'HR Compliance Officer -> Labour Relations Officer',
    observations:
      'Supports labor compliance reviews and social dialogue documentation.',
    categorieProfessionnelle: 'Cadre',
    typeContrat: 'CDI',
    dateRecrutement: '2013-01-20',
    photoColor: '#0F766E',
  },
]

function isBlank(value) {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  return false
}

function getInitials(firstName, lastName) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase()
}

function buildPhotoDataUrl(employee) {
  const fullName = `${employee.firstName} ${employee.lastName}`.replace(/\s+/g, ' ').trim()
  const initials = getInitials(employee.firstName, employee.lastName)
  const background = employee.photoColor ?? '#FF6B35'
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">',
    `<rect width="256" height="256" rx="48" fill="${background}"/>`,
    '<circle cx="128" cy="128" r="92" fill="rgba(255,255,255,0.12)"/>',
    `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700">${initials}</text>`,
    `<title>${fullName}</title>`,
    '</svg>',
  ].join('')

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function buildEmployeeWritePayload(employee, departmentId) {
  return {
    departement_id: departmentId,
    regional_branch: employee.regionalBranch,
    matricule: null,
    nom: employee.lastName,
    prenom: employee.firstName,
    sexe: employee.sexe,
    date_naissance: employee.dateNaissance,
    lieu_naissance: employee.lieuNaissance,
    nationalite: employee.nationalite,
    situation_familiale: employee.situationFamiliale,
    nombre_enfants: employee.nombreEnfants,
    adresse: employee.adresse,
    numero_securite_sociale: employee.numeroSecuriteSociale,
    diplome: employee.diplome,
    specialite: employee.specialite,
    universite: employee.universite,
    historique_postes: employee.historiquePostes,
    observations: employee.observations ?? null,
    poste: employee.poste,
    categorie_professionnelle: employee.categorieProfessionnelle,
    type_contrat: employee.typeContrat,
    date_recrutement: employee.dateRecrutement,
    email: normalizeEmail(employee.email),
    telephone: employee.telephone,
    photo_url: buildPhotoDataUrl(employee),
    is_active: true,
  }
}

function buildMissingFieldPatch(existingRow, nextValues, departmentId) {
  const patch = {}
  let completedFieldCount = 0

  const maybeFill = (column, value) => {
    if (value === undefined || value === null) {
      return
    }

    if (isBlank(existingRow[column])) {
      patch[column] = value
      completedFieldCount += 1
    }
  }

  maybeFill('departement_id', departmentId)
  maybeFill('regional_branch', nextValues.regional_branch)
  maybeFill('nom', nextValues.nom)
  maybeFill('prenom', nextValues.prenom)
  maybeFill('sexe', nextValues.sexe)
  maybeFill('date_naissance', nextValues.date_naissance)
  maybeFill('lieu_naissance', nextValues.lieu_naissance)
  maybeFill('nationalite', nextValues.nationalite)
  maybeFill('situation_familiale', nextValues.situation_familiale)
  maybeFill('nombre_enfants', nextValues.nombre_enfants)
  maybeFill('adresse', nextValues.adresse)
  maybeFill('numero_securite_sociale', nextValues.numero_securite_sociale)
  maybeFill('diplome', nextValues.diplome)
  maybeFill('specialite', nextValues.specialite)
  maybeFill('universite', nextValues.universite)
  maybeFill('historique_postes', nextValues.historique_postes)
  maybeFill('observations', nextValues.observations)
  maybeFill('poste', nextValues.poste)
  maybeFill('categorie_professionnelle', nextValues.categorie_professionnelle)
  maybeFill('type_contrat', nextValues.type_contrat)
  maybeFill('date_recrutement', nextValues.date_recrutement)
  maybeFill('email', nextValues.email)
  maybeFill('telephone', nextValues.telephone)
  maybeFill('photo_url', nextValues.photo_url)

  if (existingRow.is_active !== true) {
    patch.is_active = true
  }

  return {
    patch,
    completedFieldCount,
  }
}

function valuesMatch(currentValue, nextValue) {
  if (currentValue === nextValue) {
    return true
  }

  if (currentValue === null || currentValue === undefined) {
    return nextValue === null || nextValue === undefined
  }

  if (nextValue === null || nextValue === undefined) {
    return false
  }

  if (typeof currentValue === 'string' || typeof nextValue === 'string') {
    return String(currentValue).trim() === String(nextValue).trim()
  }

  return false
}

function buildCanonicalFieldPatch(existingRow, nextValues, departmentId) {
  const patch = {}
  let normalizedFieldCount = 0

  const maybeNormalize = (column, value) => {
    if (value === undefined) {
      return
    }

    if (valuesMatch(existingRow[column], value)) {
      return
    }

    patch[column] = value
    normalizedFieldCount += 1
  }

  maybeNormalize('departement_id', departmentId)
  maybeNormalize('regional_branch', nextValues.regional_branch)
  maybeNormalize('nom', nextValues.nom)
  maybeNormalize('prenom', nextValues.prenom)
  maybeNormalize('sexe', nextValues.sexe)
  maybeNormalize('date_naissance', nextValues.date_naissance)
  maybeNormalize('lieu_naissance', nextValues.lieu_naissance)
  maybeNormalize('nationalite', nextValues.nationalite)
  maybeNormalize('situation_familiale', nextValues.situation_familiale)
  maybeNormalize('nombre_enfants', nextValues.nombre_enfants)
  maybeNormalize('adresse', nextValues.adresse)
  maybeNormalize('numero_securite_sociale', nextValues.numero_securite_sociale)
  maybeNormalize('diplome', nextValues.diplome)
  maybeNormalize('specialite', nextValues.specialite)
  maybeNormalize('universite', nextValues.universite)
  maybeNormalize('historique_postes', nextValues.historique_postes)
  maybeNormalize('observations', nextValues.observations)
  maybeNormalize('poste', nextValues.poste)
  maybeNormalize('categorie_professionnelle', nextValues.categorie_professionnelle)
  maybeNormalize('type_contrat', nextValues.type_contrat)
  maybeNormalize('date_recrutement', nextValues.date_recrutement)
  maybeNormalize('email', nextValues.email)
  maybeNormalize('telephone', nextValues.telephone)

  return {
    patch,
    normalizedFieldCount,
  }
}

function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function normalizeEmail(value) {
  return value.trim().toLowerCase()
}

async function signInAsAdmin(client, email, password) {
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`Failed to sign in as admin for backfill mode: ${error.message}`)
  }
}

async function findAuthUserByEmail(adminClient, email) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`)
    }

    const users = data?.users ?? []
    const matchedUser = users.find(
      (user) => normalizeEmail(user.email ?? '') === normalizeEmail(email),
    )

    if (matchedUser) {
      return matchedUser
    }

    const lastPage = data?.lastPage ?? page
    if (page >= lastPage) {
      break
    }

    page += 1
  }

  return null
}

async function ensureDepartments(adminClient) {
  const { error: upsertError } = await adminClient
    .from('Departement')
    .upsert(DEPARTMENTS, { onConflict: 'nom' })

  if (upsertError) {
    throw new Error(`Failed to seed departments: ${upsertError.message}`)
  }

  const departmentNames = DEPARTMENTS.map((department) => department.nom)
  const { data, error } = await adminClient
    .from('Departement')
    .select('id, nom')
    .in('nom', departmentNames)

  if (error) {
    throw new Error(`Failed to load seeded departments: ${error.message}`)
  }

  return new Map((data ?? []).map((row) => [row.nom, row.id]))
}

async function ensureAuthUser(adminClient, employee) {
  const existingUser = await findAuthUserByEmail(adminClient, employee.email)
  if (existingUser) {
    return {
      userId: existingUser.id,
      created: false,
    }
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: employee.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: `${employee.firstName} ${employee.lastName}`,
    },
    app_metadata: {
      must_change_password: ENFORCE_FIRST_LOGIN_PASSWORD_CHANGE,
    },
  })

  if (error) {
    throw new Error(`Failed to create auth user for ${employee.email}: ${error.message}`)
  }

  if (!data.user?.id) {
    throw new Error(`Auth user creation returned an empty user id for ${employee.email}.`)
  }

  return {
    userId: data.user.id,
    created: true,
  }
}

async function ensureSecurityNotification(adminClient, userId) {
  const { data, error } = await adminClient
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('title', SECURITY_NOTIFICATION_TITLE)
    .eq('body', SECURITY_NOTIFICATION_BODY)
    .eq('link', SECURITY_NOTIFICATION_LINK)
    .limit(1)

  if (error) {
    throw new Error(`Failed to check security notification: ${error.message}`)
  }

  if ((data ?? []).length > 0) {
    return
  }

  const { error: insertError } = await adminClient.from('notifications').insert({
    user_id: userId,
    title: SECURITY_NOTIFICATION_TITLE,
    body: SECURITY_NOTIFICATION_BODY,
    link: SECURITY_NOTIFICATION_LINK,
    is_read: false,
  })

  if (insertError) {
    throw new Error(`Failed to create security notification: ${insertError.message}`)
  }
}

async function ensureEmployeeRow(adminClient, employee, departmentId, options = {}) {
  const { createWhenMissing = true, forceCanonical = false } = options
  const normalizedEmail = normalizeEmail(employee.email)
  const { data: existingRows, error: lookupError } = await adminClient
    .from('Employe')
    .select(
      [
        'id',
        'matricule',
        'departement_id',
        'regional_branch',
        'nom',
        'prenom',
        'sexe',
        'date_naissance',
        'lieu_naissance',
        'nationalite',
        'situation_familiale',
        'nombre_enfants',
        'adresse',
        'numero_securite_sociale',
        'diplome',
        'specialite',
        'universite',
        'historique_postes',
        'poste',
        'categorie_professionnelle',
        'type_contrat',
        'date_recrutement',
        'email',
        'telephone',
        'photo_url',
        'is_active',
      ].join(', '),
    )
    .ilike('email', normalizedEmail)
    .limit(1)

  if (lookupError) {
    throw new Error(`Failed to load employee row for ${employee.email}: ${lookupError.message}`)
  }

  const existingEmployee = existingRows?.[0] ?? null
  const nextValues = buildEmployeeWritePayload(employee, departmentId)

  if (existingEmployee) {
    const { patch, completedFieldCount } = buildMissingFieldPatch(
      existingEmployee,
      nextValues,
      departmentId,
    )
    const { patch: canonicalPatch, normalizedFieldCount } = forceCanonical
      ? buildCanonicalFieldPatch(existingEmployee, nextValues, departmentId)
      : { patch: {}, normalizedFieldCount: 0 }
    const mergedPatch = {
      ...patch,
      ...canonicalPatch,
    }

    if (Object.keys(mergedPatch).length === 0) {
      return {
        id: existingEmployee.id,
        matricule: existingEmployee.matricule,
        created: false,
        completedFieldCount,
        normalizedFieldCount,
      }
    }

    const { data: updatedRow, error: updateError } = await adminClient
      .from('Employe')
      .update(mergedPatch)
      .eq('id', existingEmployee.id)
      .select('id, matricule')
      .single()

    if (updateError) {
      throw new Error(`Failed to update employee row for ${employee.email}: ${updateError.message}`)
    }

      return {
        id: updatedRow.id,
        matricule: updatedRow.matricule,
        created: false,
        completedFieldCount,
        normalizedFieldCount,
      }
    }

  if (!createWhenMissing) {
    throw new Error(
      `Employee row for ${employee.email} does not exist. Rerun with SUPABASE_SERVICE_ROLE_KEY to allow full seed creation.`,
    )
  }

  const { data: createdRow, error: insertError } = await adminClient
    .from('Employe')
    .insert(nextValues)
    .select('id, matricule')
    .single()

  if (insertError) {
    throw new Error(`Failed to create employee row for ${employee.email}: ${insertError.message}`)
  }

  return {
    id: createdRow.id,
    matricule: createdRow.matricule,
    created: true,
    completedFieldCount: 0,
    normalizedFieldCount: 0,
  }
}

async function ensureEmployeeProfile(adminClient, employeId, userId) {
  const { data: userLinkedRows, error: userLinkedError } = await adminClient
    .from('ProfilUtilisateur')
    .select('id, employe_id')
    .eq('user_id', userId)
    .neq('employe_id', employeId)
    .limit(1)

  if (userLinkedError) {
    throw new Error(`Failed to validate auth linkage: ${userLinkedError.message}`)
  }

  if ((userLinkedRows ?? []).length > 0) {
    throw new Error(`Auth user ${userId} is already linked to another employee.`)
  }

  const { data: existingRows, error: lookupError } = await adminClient
    .from('ProfilUtilisateur')
    .select('id, user_id, role')
    .eq('employe_id', employeId)
    .limit(1)

  if (lookupError) {
    throw new Error(`Failed to load employee profile link: ${lookupError.message}`)
  }

  const existingProfile = existingRows?.[0] ?? null

  if (existingProfile) {
    const { error: updateError } = await adminClient
      .from('ProfilUtilisateur')
      .update({
        user_id: userId,
        role: 'EMPLOYE',
      })
      .eq('id', existingProfile.id)

    if (updateError) {
      throw new Error(`Failed to update employee profile link: ${updateError.message}`)
    }

    return
  }

  const { error: insertError } = await adminClient.from('ProfilUtilisateur').insert({
    employe_id: employeId,
    user_id: userId,
    role: 'EMPLOYE',
  })

  if (insertError) {
    throw new Error(`Failed to create employee profile link: ${insertError.message}`)
  }
}

async function verifyEmployeeLogins(supabaseUrl, anonKey, employees) {
  if (!anonKey) {
    console.log('Skipping live login verification: missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.')
    return
  }

  console.log('Verifying employee logins...')

  for (const employee of employees) {
    const client = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { error } = await client.auth.signInWithPassword({
      email: employee.email,
      password: DEMO_PASSWORD,
    })

    if (error) {
      throw new Error(`Login verification failed for ${employee.email}: ${error.message}`)
    }

    await client.auth.signOut()
    console.log(`- verified login for ${employee.email}`)
  }
}

async function main() {
  loadDotEnvFile()

  const supabaseUrl = getEnvValue('SUPABASE_URL', 'VITE_SUPABASE_URL')
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  }

  const serviceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = getEnvValue('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  const adminEmail =
    getEnvValue('EMPLOYEE_BACKFILL_ADMIN_EMAIL', 'PAYROLL_BOOTSTRAP_ADMIN_EMAIL') ??
    DEFAULT_ADMIN_EMAIL
  const adminPassword =
    getEnvValue('EMPLOYEE_BACKFILL_ADMIN_PASSWORD', 'PAYROLL_BOOTSTRAP_ADMIN_PASSWORD') ??
    DEFAULT_ADMIN_PASSWORD
  const forceCanonicalDemoFields = process.env.DEMO_EMPLOYEE_FORCE_CANONICAL === 'true'

  let adminClient
  let canManageAuth = false

  if (serviceRoleKey) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    canManageAuth = true
  } else {
    if (!anonKey) {
      throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.',
      )
    }

    adminClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    await signInAsAdmin(adminClient, adminEmail, adminPassword)
    console.log(
      'SUPABASE_SERVICE_ROLE_KEY not found. Running in employee-only backfill mode with the existing admin account.',
    )
  }

  const departmentsByName = await ensureDepartments(adminClient)

  console.log('Seeding demo employees...')
  const seededRows = []

  for (const employee of DEMO_EMPLOYEES) {
    const departmentId = departmentsByName.get(employee.department)
    if (!departmentId) {
      throw new Error(`Department not found after seed upsert: ${employee.department}`)
    }

    const authUser = canManageAuth ? await ensureAuthUser(adminClient, employee) : null
    const employeeRow = await ensureEmployeeRow(adminClient, employee, departmentId, {
      createWhenMissing: canManageAuth,
      forceCanonical: forceCanonicalDemoFields,
    })

    if (canManageAuth && authUser) {
      await ensureEmployeeProfile(adminClient, employeeRow.id, authUser.userId)

      if (ENFORCE_FIRST_LOGIN_PASSWORD_CHANGE && authUser.created) {
        await ensureSecurityNotification(adminClient, authUser.userId)
      }
    }

    seededRows.push({
      fullName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      email: employee.email,
      password: canManageAuth ? DEMO_PASSWORD : 'unchanged',
      matricule: employeeRow.matricule,
      authStatus: canManageAuth
        ? authUser?.created
          ? 'created'
          : 'existing'
        : 'skipped-no-service-role',
      employeeStatus: employeeRow.created
        ? 'created-full-profile'
        : employeeRow.completedFieldCount > 0 && employeeRow.normalizedFieldCount > 0
          ? `backfilled-${employeeRow.completedFieldCount}-normalized-${employeeRow.normalizedFieldCount}`
          : employeeRow.completedFieldCount > 0
            ? `backfilled-${employeeRow.completedFieldCount}`
            : employeeRow.normalizedFieldCount > 0
              ? `normalized-${employeeRow.normalizedFieldCount}`
              : 'already-complete',
    })

    console.log(
      `- ${employee.email} -> ${employeeRow.matricule} (${
        canManageAuth ? (authUser?.created ? 'new auth' : 'existing auth') : 'auth unchanged'
      }, ${
        employeeRow.created
          ? 'new employee'
          : employeeRow.completedFieldCount > 0 && employeeRow.normalizedFieldCount > 0
            ? `backfilled ${employeeRow.completedFieldCount} field(s), normalized ${employeeRow.normalizedFieldCount} field(s)`
            : employeeRow.completedFieldCount > 0
              ? `backfilled ${employeeRow.completedFieldCount} field(s)`
              : employeeRow.normalizedFieldCount > 0
                ? `normalized ${employeeRow.normalizedFieldCount} field(s)`
                : 'existing employee already complete'
      })`,
    )
  }

  if (canManageAuth) {
    await verifyEmployeeLogins(supabaseUrl, anonKey, DEMO_EMPLOYEES)
  } else {
    console.log('Skipping live login verification in backfill-only mode.')
  }

  console.log('')
  console.log('Demo employee seed completed.')
  console.table(seededRows)
  console.log(`First-login password change enforced: ${ENFORCE_FIRST_LOGIN_PASSWORD_CHANGE}`)
  console.log('Matricules are auto-generated by the database when missing.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

