import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

type AdminAuthorization = {
  user: User
  assuranceLevel: string | null
}

function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase public configuration is missing.')
  return { url, anonKey }
}

function getAccessToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
}

function createAuthenticatedClient() {
  const { url, anonKey } = getPublicConfig()
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function createServiceRoleClient() {
  const { url } = getPublicConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('Supabase service-role configuration is missing.')
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function getAuthenticatedUser(request: NextRequest) {
  const token = getAccessToken(request)
  if (!token) return null

  const { data, error } = await createAuthenticatedClient().auth.getUser(token)
  return error ? null : data.user
}

export async function getAuthenticatedAdmin(request: NextRequest): Promise<AdminAuthorization | null> {
  const token = getAccessToken(request)
  if (!token) return null

  const client = createAuthenticatedClient()
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) return null

  const { data: assuranceData, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(token)
  if (assuranceError) throw assuranceError

  const serviceClient = createServiceRoleClient()
  const { data: adminRole, error: roleError } = await serviceClient
    .from('admin_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (roleError) throw roleError
  if (adminRole?.role !== 'admin') return null

  return { user: userData.user, assuranceLevel: assuranceData.currentLevel }
}

export async function requireAal2Admin(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request)
  return admin?.assuranceLevel === 'aal2' ? admin : null
}