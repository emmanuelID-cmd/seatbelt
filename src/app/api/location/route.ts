import type { NextRequest } from 'next/server'
import {
  checkLocationDatabase, coordinates, LocationError, locationBody, locationContext,
  locationFailure, locationResponse, sharingId,
} from '@/lib/location'

export async function GET(request: NextRequest) {
  try {
    const { client, userId } = await locationContext(request)
    const { data, error } = await client.rpc('location_status', { p_user_id: userId })
    checkLocationDatabase(error)
    return locationResponse(data)
  } catch (error) { return locationFailure(error) }
}

export async function POST(request: NextRequest) {
  try {
    const { client, userId } = await locationContext(request)
    const body = await locationBody(request)
    const action = body.action
    if (action !== 'start' && action !== 'update' && action !== 'stop') throw new LocationError('Choose start, update, or stop.')
    const position = action === 'update' ? coordinates(body) : null
    const session = action === 'start' ? null : sharingId(body.sharingId, action === 'update')
    const { data, error } = await client.rpc('change_location_presence', {
      p_user_id: userId, p_action: action, p_sharing_id: session,
      p_latitude: position?.latitude ?? null, p_longitude: position?.longitude ?? null,
    })
    checkLocationDatabase(error)
    if (data?.error) throw new LocationError(data.error, data.status || 403)
    return locationResponse(data)
  } catch (error) { return locationFailure(error) }
}
