import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const DEFAULT_ADMIN_EMAIL = 'hrAdmin@gcb.com'
const DEFAULT_ADMIN_PASSWORD = 'hradmingcb2026'

const REGIONAL_BRANCH_CANONICAL_VALUES = new Set([
  'Alger (El Harrach, Oued Smar)',
  'Boumerd\u00e8s',
  'Arzew',
  'Hassi Messaoud',
  'Hassi R\u2019Mel',
  'In Salah',
  'Adrar',
  'In Amenas',
])

const SITUATION_FAMILIALE_CANONICAL_VALUES = new Set([
  'C\u00e9libataire',
  'Mari\u00e9(e)',
  'Divorc\u00e9(e)',
  'Veuf(ve)',
])

const SEXE_CANONICAL_VALUES = new Set(['M', 'F'])
const CATEGORIE_CANONICAL_VALUES = new Set(['Cadre', 'Agent'])
const TYPE_CONTRAT_CANONICAL_VALUES = new Set(['CDI', 'CDD'])
const DISPLAY_ONLY_PLACEHOLDER_KEYS = new Set(['not provided', 'not set', 'not available', 'not assigned', 'not reviewed', 'non renseigné', 'non défini', 'non disponible', 'non attribué', 'non examiné', 'غير مذكور', 'غير محدد', 'غير متاح', 'غير معيّن', 'لم تتم مراجعته'])

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
    .replace(/[â€™`Â´]/g, "'")
}

function normalizeDisplayOnlyPlaceholder(value) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = String(value).trim()
  if (trimmed.length === 0) {
    return null
  }

  if (DISPLAY_ONLY_PLACEHOLDER_KEYS.has(normalizeLookupKey(trimmed))) {
    return null
  }

  return trimmed
}

function normalizeRegionalBranch(value) {
  const trimmed = normalizeDisplayOnlyPlaceholder(value)
  if (trimmed === null) {
    return null
  }

  if (REGIONAL_BRANCH_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'alger' || normalized.includes('el harrach') || normalized.includes('oued smar')) {
    return 'Alger (El Harrach, Oued Smar)'
  }
  if (normalized === 'boumerdes' || normalized === 'boumerdÃ¨s' || normalized === 'boumerdÃ£Â¨s') {
    return 'Boumerd\u00e8s'
  }
  if (normalized === 'arzew') {
    return 'Arzew'
  }
  if (normalized === 'hassi messaoud') {
    return 'Hassi Messaoud'
  }
  if (
    normalized === "hassi r'mel" ||
    normalized === 'hassi râ€™mel' ||
    normalized === 'hassi rÃ¢â‚¬â„¢mel'
  ) {
    return 'Hassi R\u2019Mel'
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
  const trimmed = normalizeDisplayOnlyPlaceholder(value)
  if (trimmed === null) {
    return null
  }

  if (SITUATION_FAMILIALE_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'cÃ©libataire' || normalized === 'celibataire' || normalized === 'cÃ£Â©libataire') {
    return 'C\u00e9libataire'
  }
  if (normalized === 'mariÃ©(e)' || normalized === 'marie(e)' || normalized === 'mariÃ£Â©(e)') {
    return 'Mari\u00e9(e)'
  }
  if (normalized === 'divorcÃ©(e)' || normalized === 'divorce(e)' || normalized === 'divorcÃ£Â©(e)') {
    return 'Divorc\u00e9(e)'
  }
  if (normalized === 'veuf(ve)' || normalized === 'veuf' || normalized === 'veuve' || normalized === 'widowed') {
    return 'Veuf(ve)'
  }

  return trimmed
}

function normalizeSexe(value) {
  const trimmed = normalizeDisplayOnlyPlaceholder(value)
  if (trimmed === null) {
    return null
  }

  if (SEXE_CANONICAL_VALUES.has(trimmed)) {
    return trimmed
  }

  const normalized = normalizeLookupKey(trimmed)
  if (normalized === 'm' || normalized === 'male' || normalized === 'masculin' || normalized === 'homme') {
    return 'M'
  }
  if (normalized === 'f' || normalized === 'female' || normalized === 'feminin' || normalized === 'fÃ©minin' || normalized === 'femme') {
    return 'F'
  }

  return trimmed
}

function normalizeCategorieProfessionnelle(value) {
  const trimmed = normalizeDisplayOnlyPlaceholder(value)
  if (trimmed === null) {
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
  const trimmed = normalizeDisplayOnlyPlaceholder(value)
  if (trimmed === null) {
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
  const trimmed = normalizeDisplayOnlyPlaceholder(value)
  return trimmed ? trimmed.toLowerCase() : null
}

function normalizeTelephone(value) {
  const trimmed = normalizeDisplayOnlyPlaceholder(value)
  if (trimmed === null) {
    return null
  }

  const normalized = trimmed.replace(/\s+/g, '')
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
        'lieu_naissance',
        'nationalite',
        'situation_familiale',
        'adresse',
        'numero_securite_sociale',
        'diplome',
        'specialite',
        'universite',
        'historique_postes',
        'observations',
        'poste',
        'categorie_professionnelle',
        'type_contrat',
        'photo_url',
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

    const nextLieuNaissance = normalizeDisplayOnlyPlaceholder(row.lieu_naissance)
    if (nextLieuNaissance !== row.lieu_naissance) {
      patch.lieu_naissance = nextLieuNaissance
    }

    const nextNationalite = normalizeDisplayOnlyPlaceholder(row.nationalite)
    if (nextNationalite !== row.nationalite) {
      patch.nationalite = nextNationalite
    }

    const nextSituationFamiliale = normalizeSituationFamiliale(row.situation_familiale)
    if (nextSituationFamiliale !== row.situation_familiale) {
      patch.situation_familiale = nextSituationFamiliale
    }

    const nextAdresse = normalizeDisplayOnlyPlaceholder(row.adresse)
    if (nextAdresse !== row.adresse) {
      patch.adresse = nextAdresse
    }

    const nextNumeroSecuriteSociale = normalizeDisplayOnlyPlaceholder(row.numero_securite_sociale)
    if (nextNumeroSecuriteSociale !== row.numero_securite_sociale) {
      patch.numero_securite_sociale = nextNumeroSecuriteSociale
    }

    const nextDiplome = normalizeDisplayOnlyPlaceholder(row.diplome)
    if (nextDiplome !== row.diplome) {
      patch.diplome = nextDiplome
    }

    const nextSpecialite = normalizeDisplayOnlyPlaceholder(row.specialite)
    if (nextSpecialite !== row.specialite) {
      patch.specialite = nextSpecialite
    }

    const nextUniversite = normalizeDisplayOnlyPlaceholder(row.universite)
    if (nextUniversite !== row.universite) {
      patch.universite = nextUniversite
    }

    const nextHistoriquePostes = normalizeDisplayOnlyPlaceholder(row.historique_postes)
    if (nextHistoriquePostes !== row.historique_postes) {
      patch.historique_postes = nextHistoriquePostes
    }

    const nextObservations = normalizeDisplayOnlyPlaceholder(row.observations)
    if (nextObservations !== row.observations) {
      patch.observations = nextObservations
    }

    const nextPoste = normalizeDisplayOnlyPlaceholder(row.poste)
    if (nextPoste !== row.poste) {
      patch.poste = nextPoste
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

    const nextPhotoUrl = normalizeDisplayOnlyPlaceholder(row.photo_url)
    if (nextPhotoUrl !== row.photo_url) {
      patch.photo_url = nextPhotoUrl
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

