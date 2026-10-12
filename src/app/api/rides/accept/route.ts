import { NextResponse, type NextRequest } from 'next/server'
import { action, body, context, fail, uuid } from '../_server'
export async function POST(request: NextRequest) {
  try {
    const ctx = await context(request), input = await body(request)
    return NextResponse.json({ ride: await action(ctx, 'accept', { trip_id: uuid(input.trip_id), offer_id: uuid(input.offer_id) }) })
  } catch (error) { return fail(error) }
}
