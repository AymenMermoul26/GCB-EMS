import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const DEFAULT_ADMIN_EMAIL = 'hrAdmin@gcb.com'
const DEFAULT_ADMIN_PASSWORD = 'hradmingcb2026'

const REGIONAL_BRANCH_CANONICAL_VALUES = new Set([
  'Alger (El Harrach, Oued Smar)',
  'Boumerdès',
  'Arzew',
  'Hassi Messaoud',
  'Hassi R’Mel',
  'In Salah',
  'Adrar',
  'In Amenas',
])

const SITUATION_FAMILIALE_CANONICAL_VALUES = new Set([
  'Célibataire',
  'Marié(e)',
  'Divorcé(e)',
  'Veuf(ve)',
])

const SEXE_CANONICAL_VALUES = new Set(['M', 'F'])
const CATEGORIE_CANONICAL_VALUES = new Set(['Cadre', 'Agent'])
const TYPE_CONTRAT_CANONICAL_VALUES = new Set(['CDI', 'CDD'])

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

function normalizeLookupKey(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’`´]/g, "'")
}

function normalizeRegionalBranch(value) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  if (trimmed.length === 0) {
    return null
  }

  if (REGIONAL_BRANCH_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'alger' || normalized.includes('el harrach') || normalized.includes('oued smar')) {
    return 'Alger (El Harrach, Oued Smar)'
  }
  if (normalized === 'boumerdes' || normalized === 'boumerdès' || normalized === 'boumerdã¨s') {
    return 'Boumerdès'
  }
  if (normalized === 'arzew') {
    return 'Arzew'
  }
  if (normalized === 'hassi messaoud') {
    return 'Hassi Messaoud'
  }
  if (
    normalized === "hassi r'mel" ||
    normalized === 'hassi r’mel' ||
    normalized === 'hassi râ€™mel'
  ) {
    return 'Hassi R’Mel'
  }
  if (normalized === 'in salah') {
    return 'In Salah'
  }
  if (normalized === 'adrar') {
    return 'Adrar'
  }
  if (normalized === 'in amenas') {
    return 'In Amenas'
  }

  return trimmed
}

function normalizeSituationFamiliale(value) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  if (trimmed.length === 0) {
    return null
  }

  if (SITUATION_FAMILIALE_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'célibataire' || normalized === 'celibataire' || normalized === 'cã©libataire') {
    return 'Célibataire'
  }
  if (normalized === 'marié(e)' || normalized === 'marie(e)' || normalized === 'mariã©(e)') {
    return 'Marié(e)'
  }
  if (normalized === 'divorcé(e)' || normalized === 'divorce(e)' || normalized === 'divorcã©(e)') {
    return 'Divorcé(e)'
  }
  if (normalized === 'veuf(ve)' || normalized === 'veuf' || normalized === 'veuve' || normalized === 'widowed') {
    return 'Veuf(ve)'
  }

  return trimmed
}

function normalizeSexe(value) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  if (trimmed.length === 0) {
    return null
  }

  if (SEXE_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'm' || normalized === 'male' || normalized === 'masculin' || normalized === 'homme') {
    return 'M'
  }
  if (normalized === 'f' || normalized === 'female' || normalized === 'feminin' || normalized === 'féminin' || normalized === 'femme') {
    return 'F'
  }

  return trimmed
}

function normalizeCategorieProfessionnelle(value) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  if (trimmed.length === 0) {
    return null
  }

  if (CATEGORIE_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'cadre' || normalized === 'executive') {
    return 'Cadre'
  }
  if (normalized === 'agent') {
    return 'Agent'
  }

  return trimmed
}

function normalizeTypeContrat(value) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  if (trimmed.length === 0) {
    return null
  }

  if (TYPE_CONTRAT_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'cdi' || normalized === 'permanent') {
    return 'CDI'
  }
  if (normalized === 'cdd' || normalized === 'fixed-term' || normalized === 'fixed term') {
    return 'CDD'
  }

  return trimmed
}

function normalizeEmail(value) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

function normalizeTelephone(value) {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).trim().replace(/\s+/g, '')
  return normalized.length > 0 ? normalized : null
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

async function main() {
  loadDotEnvFile()

  const supabaseUrl = getEnvValue('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const serviceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = getEnvValue('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  const adminEmail =
    getEnvValue('EMPLOYEE_BACKFILL_ADMIN_EMAIL', 'PAYROLL_BOOTSTRAP_ADMIN_EMAIL') ??
    DEFAULT_ADMIN_EMAIL
  const adminPassword =
    getEnvValue('EMPLOYEE_BACKFILL_ADMIN_PASSWORD', 'PAYROLL_BOOTSTRAP_ADMIN_PASSWORD') ??
    DEFAULT_ADMIN_PASSWORD

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  }

  let client
  if (serviceRoleKey) {
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  } else {
    if (!anonKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.')
    }

    client = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    await signInAsAdmin(client, adminEmail, adminPassword)
  }

  const { data: rows, error } = await client
    .from('Employe')
    .select(
      [
        'id',
        'matricule',
        'email',
        'telephone',
        'regional_branch',
        'sexe',
        'situation_familiale',
        'categorie_professionnelle',
        'type_contrat',
      ].join(', '),
    )
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load employee rows: ${error.message}`)
  }

  let updatedCount = 0
  let touchedFieldCount = 0

  for (const row of rows ?? []) {
    const patch = {}

    const nextRegionalBranch = normalizeRegionalBranch(row.regional_branch)
    if (nextRegionalBranch !== row.regional_branch) {
      patch.regional_branch = nextRegionalBranch
    }

    const nextSexe = normalizeSexe(row.sexe)
    if (nextSexe !== row.sexe) {
      patch.sexe = nextSexe
    }

    const nextSituationFamiliale = normalizeSituationFamiliale(row.situation_familiale)
    if (nextSituationFamiliale !== row.situation_familiale) {
      patch.situation_familiale = nextSituationFamiliale
    }

    const nextCategorie = normalizeCategorieProfessionnelle(row.categorie_professionnelle)
    if (nextCategorie !== row.categorie_professionnelle) {
      patch.categorie_professionnelle = nextCategorie
    }

    const nextTypeContrat = normalizeTypeContrat(row.type_contrat)
    if (nextTypeContrat !== row.type_contrat) {
      patch.type_contrat = nextTypeContrat
    }

    const nextEmail = normalizeEmail(row.email)
    if (nextEmail !== row.email) {
      patch.email = nextEmail
    }

    const nextTelephone = normalizeTelephone(row.telephone)
    if (nextTelephone !== row.telephone) {
      patch.telephone = nextTelephone
    }

    const patchKeys = Object.keys(patch)
    if (patchKeys.length === 0) {
      continue
    }

    const { error: updateError } = await client
      .from('Employe')
      .update(patch)
      .eq('id', row.id)

    if (updateError) {
      throw new Error(`Failed to normalize ${row.matricule ?? row.id}: ${updateError.message}`)
    }

    updatedCount += 1
    touchedFieldCount += patchKeys.length
    console.log(`- normalized ${row.matricule ?? row.id}: ${patchKeys.join(', ')}`)
  }

  console.log('')
  console.log(`Employee normalization complete. Updated rows: ${updatedCount}. Fields normalized: ${touchedFieldCount}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
