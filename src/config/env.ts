import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_APP_NAME: z.string().optional().default('GCB EMS'),
})

const parsedEnv = envSchema.safeParse(import.meta.env)

if (!parsedEnv.success) {
  const flattened = parsedEnv.error.flatten().fieldErrors
  const details = Object.entries(flattened)
    .map(([key, messages]) => `${key}: ${(messages ?? []).join(', ')}`)
    .join(' | ')

  throw new Error(
    `Invalid environment variables. Create a .env file (not .env.example). ${details}`,
  )
}

export const env = parsedEnv.data
