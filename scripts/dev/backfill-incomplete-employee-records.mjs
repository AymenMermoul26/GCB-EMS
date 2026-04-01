import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const DEFAULT_ADMIN_EMAIL = 'hrAdmin@gcb.com'
const DEFAULT_ADMIN_PASSWORD = 'hradmingcb2026'

const EMPLOYEE_PATCHES = {
  'ADMIN-RH': {
    sexe: 'M',
    date_naissance: '1984-01-15',
    lieu_naissance: 'Alger',
    situation_familiale: 'Mari\u00e9(e)',
    nombre_enfants: 2,
    adresse: 'El Harrach, Alger',
    numero_securite_sociale: '184011500000900',
    diplome: 'Master',
    specialite: 'Ressources humaines',
    historique_postes: 'HR Officer -> HR Business Partner -> HR Administrator',
    observations:
      'Bootstrap HR administrator account for internal administration and review workflows.',
    categorie_professionnelle: 'Cadre',
    type_contrat: 'CDI',
    date_recrutement: '2010-01-10',
    telephone: '+213612340001',
  },
  'GCB-000001': {
    regional_branch: 'Alger (El Harrach, Oued Smar)',
    sexe: 'M',
    date_naissance: '1987-03-18',
    lieu_naissance: 'Blida',
    nationalite: 'Algerian',
    situation_familiale: 'Mari\u00e9(e)',
    nombre_enfants: 2,
    adresse: 'Ouled Yaich, Blida',
    numero_securite_sociale: '187031800000101',
    diplome: 'Master',
    specialite: 'Ressources humaines',
    universite: 'Universite Saad Dahlab de Blida',
    historique_postes: 'HR Assistant -> Administrative Assistant -> HR Support Coordinator',
    observations: 'Employee record completed during the April 2026 data quality pass.',
    categorie_professionnelle: 'Agent',
    type_contrat: 'CDI',
    date_recrutement: '2016-04-03',
  },
  'GCB-000014': {
    regional_branch: 'Boumerd\u00e8s',
    sexe: 'M',
    date_naissance: '1989-07-22',
    lieu_naissance: 'Boumerdes',
    nationalite: 'Algerian',
    situation_familiale: 'Mari\u00e9(e)',
    nombre_enfants: 1,
    adresse: 'Boudouaou, Boumerdes',
    numero_securite_sociale: '189072200000114',
    diplome: 'Licence',
    specialite: 'Gestion',
    universite: 'Universite Mhamed Bougara de Boumerdes',
    historique_postes: 'Administrative Assistant -> HR Coordination Officer',
    observations: 'Employee record completed during the April 2026 data quality pass.',
    categorie_professionnelle: 'Agent',
    type_contrat: 'CDI',
    date_recrutement: '2020-09-06',
  },
  'GCB-000015': {
    regional_branch: 'Hassi Messaoud',
    sexe: 'M',
    nationalite: 'Algerian',
    situation_familiale: 'C\u00e9libataire',
    nombre_enfants: 0,
    adresse: 'Maghnia, Tlemcen',
    diplome: 'Master',
    specialite: 'Ressources humaines',
    universite: 'Universite Abou Bekr Belkaid de Tlemcen',
    historique_postes: 'Training Support Assistant -> Career Development Officer',
    poste: 'Career Development Officer',
    categorie_professionnelle: 'Cadre',
    type_contrat: 'CDI',
  },
  'GCB-000016': {
    regional_branch: 'In Salah',
    sexe: 'M',
    date_naissance: '1988-11-05',
    lieu_naissance: 'Djelfa',
    nationalite: 'Algerian',
    situation_familiale: 'Mari\u00e9(e)',
    nombre_enfants: 3,
    adresse: 'Ain Oussera, Djelfa',
    numero_securite_sociale: '188110500000116',
    diplome: 'Licence',
    specialite: 'Administration publique',
    universite: "Universite d'Alger 1",
    historique_postes: 'Administrative Clerk -> Site Administration Supervisor',
    observations: 'Employee record completed during the April 2026 data quality pass.',
    telephone: '+213612340016',
  },
  'GCB-000017': {
    regional_branch: 'Adrar',
    nombre_enfants: 0,
    universite: 'Universite Kasdi Merbah Ouargla',
  },
}

const EMPLOYEE_QUALITY_OVERRIDE_RULES = {
  'GCB-000001': {
    poste: {
      match: ['Other role'],
      value: 'Administrative Assistant',
    },
  },
  'GCB-000014': {
    poste: {
      match: ['Other role'],
      value: 'Administrative Assistant',
    },
  },
  'GCB-000015': {
    observations: {
      match: ['My friend.'],
      value:
        'Employee record reviewed during the April 2026 data quality pass.',
    },
  },
  'GCB-000016': {
    poste: {
      match: ['Other role'],
      value: 'Administrative Supervisor',
    },
  },
  'GCB-000017': {
    lieu_naissance: {
      match: ['Algeria'],
      value: 'Ouargla',
    },
    adresse: {
      match: ['In the see'],
      value: 'Hai Ennasr, Ouargla',
    },
    historique_postes: {
      match: ['Work everywher and in every place'],
      value: 'HR Assistant -> Career Development Assistant -> Career Development Officer',
    },
    observations: {
      match: ['M9awd a sid hada'],
      value:
        'Employee record reviewed during the April 2026 data quality pass.',
    },
    poste: {
      match: ['Other role'],
      value: 'Career Development Officer',
    },
    specialite: {
      match: ['Autre specialisation'],
      value: 'Ressources humaines',
    },
  },
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

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function isBlank(value) {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  return false
}

async function signInAsAdmin(client, email, password) {
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`Failed to sign in as admin: ${error.message}`)
  }
}

function buildMissingFieldPatch(existingRow, nextValues) {
  const patch = {}
  let completedFieldCount = 0

  for (const [column, value] of Object.entries(nextValues)) {
    if (value === undefined) {
      continue
    }

    if (!isBlank(existingRow[column])) {
      continue
    }

    patch[column] = value
    completedFieldCount += 1
  }

  return {
    patch,
    completedFieldCount,
  }
}

function buildQualityOverridePatch(existingRow, overrideRules = {}) {
  const patch = {}
  let normalizedFieldCount = 0

  for (const [column, rule] of Object.entries(overrideRules)) {
    if (!rule) {
      continue
    }

    const currentValue = existingRow[column]
    if (!rule.match.includes(currentValue)) {
      continue
    }

    if (currentValue === rule.value) {
      continue
    }

    patch[column] = rule.value
    normalizedFieldCount += 1
  }

  return {
    patch,
    normalizedFieldCount,
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
  const adminEmail = getEnvValue('EMPLOYEE_BACKFILL_ADMIN_EMAIL') ?? DEFAULT_ADMIN_EMAIL
  const adminPassword =
    getEnvValue('EMPLOYEE_BACKFILL_ADMIN_PASSWORD') ?? DEFAULT_ADMIN_PASSWORD

  let adminClient

  if (serviceRoleKey) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
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
      'SUPABASE_SERVICE_ROLE_KEY not found. Running targeted backfill with the existing admin account.',
    )
  }

  const matricules = Object.keys(EMPLOYEE_PATCHES)
  const { data: employeeRows, error: employeeError } = await adminClient
    .from('Employe')
    .select(
      'id, matricule, nom, prenom, email, regional_branch, sexe, date_naissance, lieu_naissance, nationalite, situation_familiale, nombre_enfants, adresse, numero_securite_sociale, diplome, specialite, universite, historique_postes, observations, poste, categorie_professionnelle, type_contrat, date_recrutement, telephone',
    )
    .in('matricule', matricules)

  if (employeeError) {
    throw new Error(`Failed to load employee rows for targeted backfill: ${employeeError.message}`)
  }

  const results = []

  for (const existingRow of employeeRows ?? []) {
    const nextValues = EMPLOYEE_PATCHES[existingRow.matricule]
    const overrideRules = EMPLOYEE_QUALITY_OVERRIDE_RULES[existingRow.matricule]
    if (!nextValues) {
      continue
    }

    const { patch, completedFieldCount } = buildMissingFieldPatch(existingRow, nextValues)
    const { patch: qualityPatch, normalizedFieldCount } = buildQualityOverridePatch(
      existingRow,
      overrideRules,
    )
    const mergedPatch = {
      ...patch,
      ...qualityPatch,
    }
    if (Object.keys(mergedPatch).length === 0) {
      results.push({
        matricule: existingRow.matricule,
        employee: `${existingRow.prenom} ${existingRow.nom}`.trim(),
        status: 'already-complete',
        filledFields: 0,
        normalizedFields: 0,
      })
      continue
    }

    const { error: updateError } = await adminClient
      .from('Employe')
      .update(mergedPatch)
      .eq('id', existingRow.id)

    if (updateError) {
      throw new Error(
        `Failed to update employee row for ${existingRow.matricule}: ${updateError.message}`,
      )
    }

      results.push({
        matricule: existingRow.matricule,
        employee: `${existingRow.prenom} ${existingRow.nom}`.trim(),
        status:
          completedFieldCount > 0 && normalizedFieldCount > 0
            ? 'backfilled-and-normalized'
            : completedFieldCount > 0
              ? 'backfilled'
              : 'normalized',
        filledFields: completedFieldCount,
        normalizedFields: normalizedFieldCount,
      })
  }

  console.log('Targeted incomplete employee backfill completed.')
  console.table(results)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
