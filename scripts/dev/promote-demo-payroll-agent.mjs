import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const DEFAULT_ADMIN_EMAIL = 'hrAdmin@gcb.com'
const DEFAULT_ADMIN_PASSWORD = 'hradmingcb2026'
const DEFAULT_TARGET_EMAIL = 'lina.boudiaf@gcb.com'

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

function getRequiredEnv(...names) {
  const value = getEnvValue(...names)
  if (!value) {
    throw new Error(`Missing required environment variable. Checked: ${names.join(', ')}`)
  }

  return value
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
    throw new Error(`Failed to sign in as admin: ${error.message}`)
  }
}

async function findEmployeeByEmail(client, email) {
  const { data, error } = await client
    .from('Employe')
    .select('id, matricule, nom, prenom, email')
    .ilike('email', normalizeEmail(email))
    .limit(2)

  if (error) {
    throw new Error(`Failed to load employee by email: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error(`No employee found for ${email}.`)
  }

  if (data.length > 1) {
    throw new Error(`Multiple employees found for ${email}.`)
  }

  return data[0]
}

async function findProfileByEmployeeId(client, employeId) {
  const { data, error } = await client
    .from('ProfilUtilisateur')
    .select('id, employe_id, user_id, role')
    .eq('employe_id', employeId)
    .limit(2)

  if (error) {
    throw new Error(`Failed to load ProfilUtilisateur row: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error(`No ProfilUtilisateur row found for employee ${employeId}.`)
  }

  if (data.length > 1) {
    throw new Error(`Multiple ProfilUtilisateur rows found for employee ${employeId}.`)
  }

  return data[0]
}

async function promoteProfileToPayroll(client, profileId) {
  const { data, error } = await client
    .from('ProfilUtilisateur')
    .update({ role: 'PAYROLL_AGENT' })
    .eq('id', profileId)
    .select('id, employe_id, user_id, role')
    .single()

  if (error) {
    if (error.message.includes('ck_profilutilisateur_role')) {
      throw new Error(
        [
          'The database still rejects PAYROLL_AGENT.',
          'Apply migration 20260319124500_allow_payroll_agent_role_in_profilutilisateur.sql first, then rerun this script.',
        ].join(' '),
      )
    }

    throw new Error(`Failed to update ProfilUtilisateur role: ${error.message}`)
  }

  return data
}

async function syncPayrollAuthMetadata(supabaseUrl, serviceRoleKey, profile) {
  if (!serviceRoleKey || !profile?.user_id) {
    return false
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await adminClient.auth.admin.getUserById(profile.user_id)
  if (error) {
    throw new Error(`Failed to load auth user for payroll metadata sync: ${error.message}`)
  }

  const currentAppMetadata =
    data.user?.app_metadata &&
    typeof data.user.app_metadata === 'object' &&
    !Array.isArray(data.user.app_metadata)
      ? data.user.app_metadata
      : {}

  const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.user_id, {
    app_metadata: {
      ...currentAppMetadata,
      role: 'PAYROLL_AGENT',
      employe_id: profile.employe_id ?? null,
    },
  })

  if (updateError) {
    throw new Error(`Failed to sync payroll auth metadata: ${updateError.message}`)
  }

  return true
}

async function main() {
  loadDotEnvFile()

  const supabaseUrl = getRequiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const anonKey = getRequiredEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  const serviceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  const adminEmail = getEnvValue('PAYROLL_BOOTSTRAP_ADMIN_EMAIL') ?? DEFAULT_ADMIN_EMAIL
  const adminPassword =
    getEnvValue('PAYROLL_BOOTSTRAP_ADMIN_PASSWORD') ?? DEFAULT_ADMIN_PASSWORD
  const targetEmail = normalizeEmail(
    getEnvValue('PAYROLL_TEST_ACCOUNT_EMAIL') ?? DEFAULT_TARGET_EMAIL,
  )

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  await signInAsAdmin(client, adminEmail, adminPassword)

  const employee = await findEmployeeByEmail(client, targetEmail)
  const profile = await findProfileByEmployeeId(client, employee.id)
  const updatedProfile = await promoteProfileToPayroll(client, profile.id)
  const metadataSynced = await syncPayrollAuthMetadata(supabaseUrl, serviceRoleKey, updatedProfile)

  console.log('Payroll role assigned successfully.')
  console.log(`Employee: ${employee.prenom} ${employee.nom}`)
  console.log(`Email: ${employee.email}`)
  console.log(`Matricule: ${employee.matricule}`)
  console.log(`ProfilUtilisateur.id: ${updatedProfile.id}`)
  console.log(`Role: ${updatedProfile.role}`)
  console.log(`Auth metadata synced: ${metadataSynced}`)

  await client.auth.signOut()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
