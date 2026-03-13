import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'hrAdmin@gcb.com'
const ADMIN_PASSWORD = 'hradmingcb2026'
const ADMIN_EMPLOYEE_MATRICULE = 'ADMIN-RH'
const HR_DEPARTMENT_NAME = 'Ressources Humaines'
const HR_DEPARTMENT_CODE = 'RH'
const EMPLOYEE_LAST_NAME = 'Admin'
const EMPLOYEE_FIRST_NAME = 'HR'
const EMPLOYEE_JOB_TITLE = 'Administrateur RH'
const SAFE_RESET_TABLES = [
  'notifications',
  'audit_log',
  'employee_visibility',
  'DemandeModification',
  'TokenQR',
  'ProfilUtilisateur',
  'Employe',
  'Departement',
]

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

function isHostedSupabaseProject(url) {
  return /https:\/\/[a-z0-9-]+\.supabase\.co/i.test(url)
}

function isLocalSupabaseProject(url) {
  return /localhost|127\.0\.0\.1/i.test(url)
}

async function deleteAllRows(client, tableName) {
  const { error } = await client.from(tableName).delete().not('id', 'is', null)
  if (error) {
    throw new Error(`Failed to clear ${tableName}: ${error.message}`)
  }
}

async function deleteAllAuthUsers(adminClient) {
  let page = 1
  const perPage = 200
  let deletedCount = 0

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`)
    }

    const users = data?.users ?? []
    if (users.length === 0) {
      break
    }

    for (const user of users) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
      if (deleteError) {
        throw new Error(`Failed to delete auth user ${user.email ?? user.id}: ${deleteError.message}`)
      }
      deletedCount += 1
    }

    const lastPage = data?.lastPage ?? page
    if (page >= lastPage) {
      break
    }

    page += 1
  }

  return deletedCount
}

async function resetMatriculeSequence(adminClient, value = 1, isCalled = false) {
  const { error } = await adminClient.rpc('reset_employe_matricule_sequence', {
    p_value: value,
    p_is_called: isCalled,
  })

  if (error) {
    throw new Error(`Failed to reset employee matricule sequence: ${error.message}`)
  }
}

async function ensureDepartment(adminClient) {
  const { data, error } = await adminClient
    .from('Departement')
    .insert({
      nom: HR_DEPARTMENT_NAME,
      code: HR_DEPARTMENT_CODE,
      description: 'HR administration department for bootstrap testing.',
    })
    .select('id, nom')
    .single()

  if (error) {
    throw new Error(`Failed to create HR department: ${error.message}`)
  }

  return data
}

async function ensureAdminEmployee(adminClient, departmentId) {
  const { data, error } = await adminClient
    .from('Employe')
    .insert({
      departement_id: departmentId,
      matricule: ADMIN_EMPLOYEE_MATRICULE,
      nom: EMPLOYEE_LAST_NAME,
      prenom: EMPLOYEE_FIRST_NAME,
      poste: EMPLOYEE_JOB_TITLE,
      email: ADMIN_EMAIL,
      telephone: null,
      is_active: true,
    })
    .select('id, matricule, nom, prenom')
    .single()

  if (error) {
    throw new Error(`Failed to create admin employee row: ${error.message}`)
  }

  return data
}

async function createAdminAuthUser(adminClient) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'HR Admin',
    },
    app_metadata: {
      must_change_password: false,
    },
  })

  if (error) {
    throw new Error(`Failed to create admin auth user: ${error.message}`)
  }

  if (!data.user?.id) {
    throw new Error('Auth admin bootstrap returned an empty user id.')
  }

  return data.user
}

async function linkAdminProfile(adminClient, employeId, userId) {
  const { error } = await adminClient
    .from('ProfilUtilisateur')
    .insert({
      employe_id: employeId,
      user_id: userId,
      role: 'ADMIN_RH',
    })

  if (error) {
    throw new Error(`Failed to create admin profile link: ${error.message}`)
  }
}

async function main() {
  loadDotEnvFile()

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  }

  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const allowRemoteReset = process.env.ALLOW_REMOTE_DESTRUCTIVE_RESET === 'true'

  if (isHostedSupabaseProject(supabaseUrl) && !allowRemoteReset) {
    throw new Error(
      [
        `Refusing destructive reset against hosted Supabase project: ${supabaseUrl}`,
        'This project is not local Docker and may be production or shared staging.',
        'If you intentionally want to reset this hosted environment, rerun with ALLOW_REMOTE_DESTRUCTIVE_RESET=true.',
      ].join(' '),
    )
  }

  if (!isHostedSupabaseProject(supabaseUrl) && !isLocalSupabaseProject(supabaseUrl)) {
    throw new Error(`Unable to classify Supabase environment from URL: ${supabaseUrl}`)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  console.log('Reset target:', supabaseUrl)
  console.log('Clearing business tables...')
  for (const tableName of SAFE_RESET_TABLES) {
    await deleteAllRows(adminClient, tableName)
    console.log(`- cleared ${tableName}`)
  }
  await resetMatriculeSequence(adminClient, 1, false)
  console.log('- reset employe_matricule_seq to start at GCB-000001')

  console.log('Deleting auth users...')
  const deletedUsers = await deleteAllAuthUsers(adminClient)
  console.log(`- deleted ${deletedUsers} auth user(s)`)

  console.log('Creating bootstrap admin data...')
  const department = await ensureDepartment(adminClient)
  const employee = await ensureAdminEmployee(adminClient, department.id)
  const authUser = await createAdminAuthUser(adminClient)
  await linkAdminProfile(adminClient, employee.id, authUser.id)

  console.log('Bootstrap complete.')
  console.log(`Admin email: ${ADMIN_EMAIL}`)
  console.log(`Admin password: ${ADMIN_PASSWORD}`)
  console.log(`Department: ${department.nom}`)
  console.log(`Employee ID: ${employee.matricule}`)
  console.log(`Auth user id: ${authUser.id}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
