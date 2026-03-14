import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

const DEMO_PASSWORD = 'GcbEmployee2026!'
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
  },
  {
    firstName: 'Amine',
    lastName: 'Kherfi',
    poste: 'Workforce Planning Analyst',
    email: 'amine.kherfi@gcb.com',
    telephone: '+213612345602',
    department: 'Service Planification et Contr\u00F4le des Effectifs',
  },
  {
    firstName: 'Sara',
    lastName: 'Meziane',
    poste: 'IT Support Engineer',
    email: 'sara.meziane@gcb.com',
    telephone: '+213612345603',
    department: 'D\u00E9partement Informatique',
  },
  {
    firstName: 'Lina',
    lastName: 'Boudiaf',
    poste: 'Financial Controller',
    email: 'lina.boudiaf@gcb.com',
    telephone: '+213612345604',
    department: 'D\u00E9partement Finance et Comptabilit\u00E9',
  },
  {
    firstName: 'Walid',
    lastName: 'Cheriet',
    poste: 'Procurement Officer',
    email: 'walid.cheriet@gcb.com',
    telephone: '+213612345605',
    department: 'D\u00E9partement Achats et Approvisionnement',
  },
  {
    firstName: 'Ilyes',
    lastName: 'Ferhat',
    poste: 'Logistics Coordinator',
    email: 'ilyes.ferhat@gcb.com',
    telephone: '+213612345606',
    department: 'D\u00E9partement Logistique',
  },
  {
    firstName: 'Ines',
    lastName: 'Rahmani',
    poste: 'HSE Specialist',
    email: 'ines.rahmani@gcb.com',
    telephone: '+213612345607',
    department: 'D\u00E9partement HSE',
  },
  {
    firstName: 'Karim',
    lastName: 'Touati',
    poste: 'Administrative Supervisor',
    email: 'karim.touati@gcb.com',
    telephone: '+213612345608',
    department: 'D\u00E9partement Administration G\u00E9n\u00E9rale',
  },
  {
    firstName: 'Nadia',
    lastName: 'Benali',
    poste: 'Career Development Officer',
    email: 'nadia.benali@gcb.com',
    telephone: '+213612345609',
    department: 'Service Gestion des Carri\u00E8res',
  },
  {
    firstName: 'Samir',
    lastName: 'Bouzid',
    poste: 'Training Coordinator',
    email: 'samir.bouzid@gcb.com',
    telephone: '+213612345610',
    department: 'D\u00E9partement Formation',
  },
  {
    firstName: 'Ryma',
    lastName: 'Saadi',
    poste: 'Recruitment Specialist',
    email: 'ryma.saadi@gcb.com',
    telephone: '+213612345611',
    department: 'Service S\u00E9lection et Recrutement',
  },
  {
    firstName: 'Mourad',
    lastName: 'Hamidi',
    poste: 'Labour Relations Officer',
    email: 'mourad.hamidi@gcb.com',
    telephone: '+213612345612',
    department: 'D\u00E9partement Relations de Travail',
  },
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

function normalizeEmail(value) {
  return value.trim().toLowerCase()
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

async function ensureEmployeeRow(adminClient, employee, departmentId) {
  const normalizedEmail = normalizeEmail(employee.email)
  const { data: existingRows, error: lookupError } = await adminClient
    .from('Employe')
    .select('id, matricule, email')
    .ilike('email', normalizedEmail)
    .limit(1)

  if (lookupError) {
    throw new Error(`Failed to load employee row for ${employee.email}: ${lookupError.message}`)
  }

  const existingEmployee = existingRows?.[0] ?? null

  if (existingEmployee) {
    const { data: updatedRow, error: updateError } = await adminClient
      .from('Employe')
      .update({
        departement_id: departmentId,
        nom: employee.lastName,
        prenom: employee.firstName,
        poste: employee.poste,
        email: normalizedEmail,
        telephone: employee.telephone,
        is_active: true,
      })
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
    }
  }

  const { data: createdRow, error: insertError } = await adminClient
    .from('Employe')
    .insert({
      departement_id: departmentId,
      matricule: null,
      nom: employee.lastName,
      prenom: employee.firstName,
      poste: employee.poste,
      email: normalizedEmail,
      telephone: employee.telephone,
      is_active: true,
    })
    .select('id, matricule')
    .single()

  if (insertError) {
    throw new Error(`Failed to create employee row for ${employee.email}: ${insertError.message}`)
  }

  return {
    id: createdRow.id,
    matricule: createdRow.matricule,
    created: true,
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

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  }

  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim()

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const departmentsByName = await ensureDepartments(adminClient)

  console.log('Seeding demo employees...')
  const seededRows = []

  for (const employee of DEMO_EMPLOYEES) {
    const departmentId = departmentsByName.get(employee.department)
    if (!departmentId) {
      throw new Error(`Department not found after seed upsert: ${employee.department}`)
    }

    const authUser = await ensureAuthUser(adminClient, employee)
    const employeeRow = await ensureEmployeeRow(adminClient, employee, departmentId)
    await ensureEmployeeProfile(adminClient, employeeRow.id, authUser.userId)

    if (ENFORCE_FIRST_LOGIN_PASSWORD_CHANGE && authUser.created) {
      await ensureSecurityNotification(adminClient, authUser.userId)
    }

    seededRows.push({
      fullName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      email: employee.email,
      password: DEMO_PASSWORD,
      matricule: employeeRow.matricule,
      authStatus: authUser.created ? 'created' : 'existing',
      employeeStatus: employeeRow.created ? 'created' : 'updated',
    })

    console.log(
      `- ${employee.email} -> ${employeeRow.matricule} (${authUser.created ? 'new auth' : 'existing auth'}, ${
        employeeRow.created ? 'new employee' : 'existing employee'
      })`,
    )
  }

  await verifyEmployeeLogins(supabaseUrl, anonKey, DEMO_EMPLOYEES)

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
