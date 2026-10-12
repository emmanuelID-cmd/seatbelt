import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient, getAuthenticatedUser } from '@/lib/supabaseServer'

export type LocationStatus = {
  canShare: boolean
  sharing: boolean
  locationSharing: boolean
  reason: string | null
}

export type NearbyDriver = {
  driverId: string
  latitude: number
  longitude: number
  approximateMiles: number
  expiresAt: string
}

export type NearbyResult = { drivers: NearbyDriver[]; radiusMiles: number }
export type SharingSession = { sharingId: string; expiresAt: string }

export class LocationError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export function locationResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization' } })
}

export function locationFailure(error: unknown) {
  if (error instanceof LocationError) return locationResponse({ error: error.message }, error.status)
  // Do not return database details, coordinates, tokens, or provider errors.
  return locationResponse({ error: 'Location is temporarily unavailable. Please try again.' }, 503)
}

export async function locationContext(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new LocationError('Location is unavailable because server configuration is incomplete.', 503)
  }
  const user = await getAuthenticatedUser(request)
  if (!user || user.is_anonymous) throw new LocationError('Please sign in again to use location.', 401)
  return { userId: user.id, client: createServiceRoleClient() }
}

export async function locationBody(request: NextRequest): Promise<Record<string, unknown>> {
  const raw = await request.text()
  if (raw.length > 2048) throw new LocationError('The location request is too large.', 413)
  let body: unknown
  try { body = JSON.parse(raw) } catch { throw new LocationError('Send a valid location request.') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new LocationError('Send a valid location request.')
  return body as Record<string, unknown>
}

export function coordinates(body: Record<string, unknown>) {
  const { latitude, longitude } = body
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new LocationError('A valid device location is required. Retry the location request.')
  }
  // Precise browser coordinates never reach persistent storage.
  return { latitude: Math.round(latitude * 50) / 50, longitude: Math.round(longitude * 50) / 50 }
}

export function sharingId(value: unknown, required: boolean) {
  if (value === undefined && !required) return null
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new LocationError('The sharing session is invalid. Start sharing again.')
  }
  return value
}

export function checkLocationDatabase(error: { code?: string } | null) {
  if (!error) return
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code || '')) {
    throw new LocationError('Location is unavailable until the required database setup is complete.', 503)
  }
  throw new LocationError('Location is temporarily unavailable. Please try again.', 503)
}
