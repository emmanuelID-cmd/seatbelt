import { NextResponse, type NextRequest } from 'next/server'
import { action, body, context, fail, RideError, uuid } from '../_server'
export async function POST(request: NextRequest) {
  try {
    const ctx = await context(request), input = await body(request)
    if (typeof input.amount_cents !== 'number' || !Number.isInteger(input.amount_cents) || input.amount_cents < 100 || input.amount_cents > 99900) throw new RideError('Driver offers must be $1.00–$999.00 with up to two decimal places.')
    return NextResponse.json({ offer: await action(ctx, 'offer', { trip_id: uuid(input.trip_id), other_id: uuid(input.other_id), amount_cents: input.amount_cents }) })
  } catch (error) { return fail(error) }
}
