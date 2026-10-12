import { NextResponse, type NextRequest } from 'next/server'
import { action, body, check, context, fail, RideError, tripColumns, uuid, type RideContext } from '../../_server'
import { validateMessage } from '@/lib/inputValidation'

async function conversation(ctx: RideContext, tripId: string, requestedOther: string | null) {
  const result = await ctx.db.from('trips').select(tripColumns).eq('id', tripId).single()
  check(result.error)
  const trip = result.data
  if (!trip) throw new RideError('Conversation unavailable.', 404)
  const owner = trip.post_type === 'driver' ? trip.driver_id : trip.rider_id
  const otherId = requestedOther ? uuid(requestedOther) : owner === ctx.user.id ? null : owner
  if (!otherId || otherId === ctx.user.id || (owner !== ctx.user.id && otherId !== owner)) throw new RideError('Choose the person from your Messages list.', 403)
  const pair = `and(sender_id.eq.${ctx.user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${ctx.user.id})`
  // A post owner cannot pick an arbitrary stranger as an existing correspondent.
  if (owner === ctx.user.id || !trip.is_active) {
    let previous = ctx.db.from('messages').select('id').eq('trip_id', tripId)
    previous = owner === ctx.user.id ? previous.eq('sender_id', otherId).eq('receiver_id', ctx.user.id) : previous.or(pair)
    const known = await previous.limit(1)
    check(known.error)
    if (!known.data?.length) throw new RideError('This conversation is not available to your account.', 403)
  }
  return { trip, otherId, pair, isDriver: trip.post_type === 'driver' ? owner === ctx.user.id : owner !== ctx.user.id }
}
type Params = { params: Promise<{ tripId: string }> }
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const ctx = await context(request), tripId = uuid((await params).tripId)
    const scope = await conversation(ctx, tripId, request.nextUrl.searchParams.get('with'))
    const page = Number(request.nextUrl.searchParams.get('page') || '0')
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw new RideError('Choose a valid conversation page.')
    const results = await Promise.all([
      ctx.db.from('messages').select('id,trip_id,sender_id,receiver_id,content,created_at').eq('trip_id', tripId).or(scope.pair).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 100, page * 100 + 100),
      ctx.db.from('ride_offers').select('*').eq('trip_id', tripId).eq('driver_id', scope.isDriver ? ctx.user.id : scope.otherId).eq('rider_id', scope.isDriver ? scope.otherId : ctx.user.id).order('created_at', { ascending: false }).limit(20),
      ctx.db.from('rides').select('*').eq('trip_id', tripId).eq('driver_id', scope.isDriver ? ctx.user.id : scope.otherId).eq('rider_id', scope.isDriver ? scope.otherId : ctx.user.id).maybeSingle(),
      ctx.db.from('profiles').select('id,full_name').eq('id', scope.otherId).single(),
    ])
    results.forEach(result => check(result.error))
    return NextResponse.json({ trip: scope.trip, other: results[3].data, userId: ctx.user.id, isDriver: scope.isDriver,
      messages: (results[0].data || []).slice(0, 100).reverse(), hasMore: (results[0].data?.length || 0) > 100,
      offers: results[1].data || [], ride: results[2].data })
  } catch (error) { return fail(error) }
}
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const ctx = await context(request), input = await body(request), tripId = uuid((await params).tripId)
    const otherId = uuid(input.other_id)
    const error = typeof input.content === 'string' ? validateMessage(input.content) : 'Enter a message.'
    if (error) throw new RideError(error)
    return NextResponse.json({ message: await action(ctx, 'message', { trip_id: tripId, other_id: otherId, content: input.content }) }, { status: 201 })
  } catch (error) { return fail(error) }
}
