import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const DEFAULT_EMAIL = 'lina.boudiaf@gcb.com'
const DEFAULT_PASSWORD = 'GcbEmployee2026!'

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

async function findAuthUserByEmail(adminClient, email) {
  let page = 1
  const perPage = 200
  const normalizedEmail = normalizeEmail(email)

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`)
    }

    const users = data?.users ?? []
    const matchedUser = users.find(
      (user) => normalizeEmail(user.email ?? '') === normalizedEmail,
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

async function findProfileByUserId(adminClient, userId) {
  const { data, error } = await adminClient
    .from('ProfilUtilisateur')
    .select('id, employe_id, role')
    .eq('user_id', userId)
    .limit(2)

  if (error) {
    throw new Error(`Failed to load ProfilUtilisateur by user id: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return null
  }

  if (data.length > 1) {
    throw new Error(`Multiple ProfilUtilisateur rows found for auth user ${userId}.`)
  }

  return data[0]
}

async function main() {
  loadDotEnvFile()

  const supabaseUrl = getRequiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const targetEmail = normalizeEmail(
    getEnvValue('TARGET_AUTH_EMAIL', 'PAYROLL_TEST_ACCOUNT_EMAIL') ?? DEFAULT_EMAIL,
  )
  const nextPassword =
    getEnvValue('TARGET_AUTH_PASSWORD', 'PAYROLL_TEST_ACCOUNT_PASSWORD') ?? DEFAULT_PASSWORD

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const user = await findAuthUserByEmail(adminClient, targetEmail)
  if (!user?.id) {
    throw new Error(`No auth user found for ${targetEmail}.`)
  }

  const currentAppMetadata =
    user.app_metadata && typeof user.app_metadata === 'object' && !Array.isArray(user.app_metadata)
      ? user.app_metadata
      : {}
  const linkedProfile = await findProfileByUserId(adminClient, user.id)

  const { error } = await adminClient.auth.admin.updateUserById(user.id, {
    password: nextPassword,
    email_confirm: true,
    app_metadata: {
      ...currentAppMetadata,
      must_change_password: false,
      ...(linkedProfile?.role ? { role: linkedProfile.role } : {}),
      ...(linkedProfile?.employe_id ? { employe_id: linkedProfile.employe_id } : {}),
    },
  })

  if (error) {
    throw new Error(`Failed to update password for ${targetEmail}: ${error.message}`)
  }

  console.log('Password updated successfully.')
  console.log(`Email: ${targetEmail}`)
  console.log(`User ID: ${user.id}`)
  console.log('must_change_password: false')
  console.log(`role metadata: ${linkedProfile?.role ?? 'unchanged'}`)
  console.log(`employe_id metadata: ${linkedProfile?.employe_id ?? 'unchanged'}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
