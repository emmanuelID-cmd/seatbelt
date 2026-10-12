import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient, getAuthenticatedUser } from '@/lib/supabaseServer'
import { postErrors, type PostInput, type RideSession } from '@/lib/rides'

export class RideError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export const tripColumns = 'id,driver_id,rider_id,post_type,origin,destination,departure_time,seats_available,suggested_price,price_min,price_max,currency_code,notes,is_active,created_at'
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new RideError('Choose a valid ride or conversation.')
  return value
}
export async function body(request: NextRequest): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.length > 12000) throw new RideError('This request is too large.', 413)
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new RideError('The request could not be read.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RideError('The request could not be read.')
  return value as Record<string, unknown>
}
export function fail(error: unknown) {
  const known = error instanceof RideError
  return NextResponse.json({ error: known ? error.message : 'Ride services are temporarily unavailable. Please try again.' }, { status: known ? error.status : 503 })
}
export function check(error: { code?: string; message?: string } | null) {
  if (!error) return
  const messages: Record<string, string> = {
    NOT_AUTHORIZED: 'This ride or conversation is not available to your account.',
    ACCOUNT_INACTIVE: 'Both accounts must be active to arrange or start a ride.',
    ACCOUNT_INCOMPLETE: 'Complete your private Account settings before arranging a ride. Both participants need completed accounts.',
    DRIVER_INELIGIBLE: 'The Driver needs verified identity and approved, unexpired eligibility documents.',
    MODE_REQUIRED: 'Choose the appropriate session mode before continuing.',
    POST_LOCKED: 'This post is closed or already accepted. Its terms cannot be changed.',
    INVALID_TRANSITION: 'That action is not available for the current ride status.',
    CONVERSATION_REQUIRED: 'Start a conversation with this participant before sending an offer.',
    INVALID_INPUT: 'Check the required fields and their allowed ranges.',
    INVALID_DEPARTURE: 'Choose a future departure date and time, or Present.',
    INVALID_MESSAGE: 'Enter a message of 1–140 characters.',
    INVALID_AMOUNT: 'Driver offers must be $1.00–$999.00.',
    PAYMENT_RESERVED: 'Payment has already begun for this ride. Contact support to arrange cancellation and any applicable refund.',
  }
  if (error.code === '23505') throw new RideError('This ride has already been accepted or your review is already saved.', 409)
  if (error.code === '42P01' || error.code === '42883' || error.code?.startsWith('PGRST')) throw new RideError('Ride services are not configured yet. Please try again after setup is complete.', 503)
  if (error.message && messages[error.message]) throw new RideError(messages[error.message], error.message === 'NOT_AUTHORIZED' ? 403 : 409)
  throw new RideError('Ride services are temporarily unavailable. Please try again.', 503)
}
export async function context(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new RideError('Ride services are not configured yet.', 503)
  const user = await getAuthenticatedUser(request)
  if (!user || user.is_anonymous) throw new RideError('Please sign in again to continue.', 401)
  return { user, db: createServiceRoleClient() }
}
export type RideContext = Awaited<ReturnType<typeof context>>
export async function session(ctx: RideContext): Promise<RideSession> {
  const { data, error } = await ctx.db.from('profiles').select('account_role,last_session_mode').eq('id', ctx.user.id).single()
  check(error)
  if (!data) throw new RideError('Your account profile could not be loaded.', 503)
  const eligibility = await ctx.db.rpc('seatbelt_driver_eligible', { p_user: ctx.user.id })
  check(eligibility.error)
  return { userId: ctx.user.id, mode: data.last_session_mode === 'driver' && eligibility.data ? 'driver' : 'rider', driverEligible: eligibility.data === true, accountRole: data.account_role }
}
export async function action(ctx: RideContext, name: string, payload: Record<string, unknown>) {
  // Initialize only a missing preference row; never overwrite a frozen account.
  const initialized = await ctx.db.from('account_preferences').upsert({ user_id: ctx.user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
  check(initialized.error)
  if (name === 'accept' || name === 'create_post') {
    const [{ data: profile, error: profileError }, { data: identity, error: identityError }] = await Promise.all([
      ctx.db.from('profiles').select('last_session_mode').eq('id', ctx.user.id).single(),
      ctx.db.from('identity_verifications').select('status').eq('user_id', ctx.user.id).maybeSingle(),
    ])
    check(profileError)
    check(identityError)
    if (!profile) throw new RideError('Your account profile could not be loaded.', 503)
    // Riders verify before posting or accepting. Driver offers remain gated by
    // the stronger Driver License and eligibility checks in the database.
    if ((name === 'accept' || (name === 'create_post' && profile.last_session_mode !== 'driver')) && identity?.status !== 'verified') {
      throw new RideError('Verify your identity before posting a Rider trip or accepting a ride. Start secure verification in Profile Settings.', 403)
    }
  }
  const result = await ctx.db.rpc('seatbelt_ride_action', { p_actor: ctx.user.id, p_action: name, p_payload: payload })
  check(result.error)
  return result.data
}
export function postInput(value: Record<string, unknown>, mode: 'rider' | 'driver'): PostInput {
  if (typeof value.origin !== 'string' || typeof value.destination !== 'string' || typeof value.notes !== 'string'
    || typeof value.seats_available !== 'number' || (value.departure_time !== null && typeof value.departure_time !== 'string')
    || (value.price_min !== null && typeof value.price_min !== 'number') || (value.price_max !== null && typeof value.price_max !== 'number')) throw new RideError('Check the post fields and try again.')
  const input = value as unknown as PostInput
  const errors = postErrors(input, mode)
  if (Object.keys(errors).length) throw new RideError(Object.values(errors).join(' '))
  return { origin: input.origin.trim(), destination: input.destination.trim(), notes: input.notes.trim(), seats_available: input.seats_available,
    departure_time: mode === 'rider' ? input.departure_time : null, price_min: mode === 'rider' ? input.price_min : null, price_max: mode === 'rider' ? input.price_max : null }
}
