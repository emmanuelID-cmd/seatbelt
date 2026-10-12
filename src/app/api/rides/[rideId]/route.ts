import { NextResponse, type NextRequest } from 'next/server'
import { action, body, context, fail, RideError, uuid } from '../_server'
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ rideId: string }> }) {
  try {
    const ctx = await context(request), input = await body(request)
    if (input.action !== 'start' && input.action !== 'complete' && input.action !== 'cancel') throw new RideError('Choose a valid ride action.')
    return NextResponse.json({ ride: await action(ctx, input.action, { ride_id: uuid((await params).rideId) }) })
  } catch (error) { return fail(error) }
}
