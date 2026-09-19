import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase public configuration is missing.')
  return { url, anonKey }
}

export function createServiceRoleClient() {
  const { url } = getPublicConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('Supabase service-role configuration is missing.')
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function getAuthenticatedUser(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return null

  const { url, anonKey } = getPublicConfig()
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.getUser(token)
  return error ? null : data.user
}