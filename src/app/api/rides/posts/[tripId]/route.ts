import { NextResponse, type NextRequest } from 'next/server'
import { action, body, check, context, fail, postInput, RideError, tripColumns, uuid, type RideContext } from '../../_server'
async function owned(ctx: RideContext, id: string) {
  const result = await ctx.db.from('trips').select(tripColumns).eq('id', id).single()
  check(result.error)
  if (!result.data || (result.data.post_type === 'driver' ? result.data.driver_id : result.data.rider_id) !== ctx.user.id) throw new RideError('This post is not available to your account.', 403)
  return result.data
}
type Params = { params: Promise<{ tripId: string }> }
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const ctx = await context(request), id = uuid((await params).tripId)
    const trip = await owned(ctx, id)
    const ride = await ctx.db.from('rides').select('id').eq('trip_id', id).maybeSingle()
    check(ride.error)
    return NextResponse.json({ trip, locked: Boolean(ride.data) })
  } catch (error) { return fail(error) }
}
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const ctx = await context(request), id = uuid((await params).tripId), trip = await owned(ctx, id)
    return NextResponse.json({ trip: await action(ctx, 'edit_post', { ...postInput(await body(request), trip.post_type as 'rider' | 'driver'), trip_id: id }) })
  } catch (error) { return fail(error) }
}
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const ctx = await context(request)
    return NextResponse.json({ trip: await action(ctx, 'delete_post', { trip_id: uuid((await params).tripId) }) })
  } catch (error) { return fail(error) }
}
