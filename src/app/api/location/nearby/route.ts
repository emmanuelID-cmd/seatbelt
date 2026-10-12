import type { NextRequest } from 'next/server'
import {
  checkLocationDatabase, coordinates, LocationError, locationBody, locationContext,
  locationFailure, locationResponse,
} from '@/lib/location'

// POST keeps the search origin out of URLs and access-log query strings.
// It is used transiently and is never stored or published as Rider presence.
export async function POST(request: NextRequest) {
  try {
    const { client, userId } = await locationContext(request)
    const position = coordinates(await locationBody(request))
    const { data, error } = await client.rpc('discover_nearby_drivers', {
      p_user_id: userId, p_latitude: position.latitude, p_longitude: position.longitude,
    })
    checkLocationDatabase(error)
    if (data?.error) throw new LocationError(data.error, data.status || 403)
    return locationResponse(data)
  } catch (error) { return locationFailure(error) }
}
