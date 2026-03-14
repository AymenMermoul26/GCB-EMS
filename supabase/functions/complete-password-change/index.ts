import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const SECURITY_NOTIFICATION_TITLE = 'Security'
const SECURITY_NOTIFICATION_BODY = 'Welcome! Please change your password to a strong one.'
const SECURITY_NOTIFICATION_LINK = '/employee/security'

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function extractBearerToken(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  const prefix = 'bearer '
  if (trimmed.toLowerCase().startsWith(prefix)) {
    const token = trimmed.slice(prefix.length).trim()
    return token.length > 0 ? token : null
  }

  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Server configuration error.' })
  }

  const accessToken = extractBearerToken(request.headers.get('Authorization'))
  if (!accessToken) {
    return jsonResponse(401, { error: 'Missing Authorization header.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
  const user = userData.user

  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized.' })
  }

  const appMetadata = asRecord(user.app_metadata)
  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...appMetadata,
      must_change_password: false,
    },
  })

  if (updateError) {
    return jsonResponse(500, { error: updateError.message })
  }

  const { error: notificationError } = await adminClient
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('title', SECURITY_NOTIFICATION_TITLE)
    .eq('body', SECURITY_NOTIFICATION_BODY)
    .eq('link', SECURITY_NOTIFICATION_LINK)
    .eq('is_read', false)

  if (notificationError) {
    return jsonResponse(500, { error: notificationError.message })
  }

  return jsonResponse(200, {
    ok: true,
    user_id: user.id,
    must_change_password: false,
  })
})
