import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, getAuthenticatedUser } from '@/lib/supabaseServer'
import { getIdentityStripe, getVerifiedDriverLicenseExpiry, identityResultsConfigured } from '@/lib/stripeIdentity'

export const runtime = 'nodejs'

type Purpose = 'identity' | 'driver_license' | 'driver_eligibility'
type Method = 'document' | 'id_number'
type IdentityStatus = 'requires_input' | 'processing' | 'verified' | 'canceled'
type VerificationRecord = {
  stripe_verification_session_id: string | null
  status: IdentityStatus
  last_error_message?: string | null
  verification_method?: Method
  license_expires_on?: string | null
}
type VerificationResponse = {
  status: IdentityStatus | 'not_started'
  clientSecret?: string
  verificationMethod?: Method
  licenseExpiresOn?: string | null
  licenseExpiryConfigured?: boolean
  error?: string
}

function parsePurpose(value: string | null): Purpose | null {
  return value === null || value === 'identity' ? 'identity' : value === 'driver_license' ? 'driver_license' : value === 'driver_eligibility' ? 'driver_eligibility' : null
}

function parseMethod(value: unknown): Method | null {
  return value === 'document' || value === 'id_number' ? value : null
}

function isMissingVerificationSession(error: unknown) {
  return error instanceof Error && error.message.includes('No such VerificationSession')
}

function responseFor(record: VerificationRecord | null, purpose: Purpose, clientSecret?: string | null): NextResponse {
  const body: VerificationResponse = {
    status: record?.status || 'not_started',
    verificationMethod: purpose === 'driver_eligibility' ? 'id_number' : purpose === 'identity' ? record?.verification_method || 'document' : 'document',
    ...(purpose === 'driver_license' ? {
      licenseExpiresOn: record?.license_expires_on || null,
      licenseExpiryConfigured: identityResultsConfigured(),
    } : {}),
  }
  if (clientSecret) body.clientSecret = clientSecret
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
}

async function readVerification(db: ReturnType<typeof createServiceRoleClient>, purpose: Purpose, userId: string) {
  const result = purpose === 'identity'
    ? await db.from('identity_verifications').select('stripe_verification_session_id,status,verification_method,last_error_message').eq('user_id', userId).maybeSingle()
    : purpose === 'driver_license'
      ? await db.from('driver_license_verifications').select('stripe_verification_session_id,status,license_expires_on,last_error_message').eq('user_id', userId).maybeSingle()
      : await db.from('driver_eligibility_identity_checks').select('stripe_verification_session_id,status,last_error_message').eq('user_id', userId).maybeSingle()
  if (result.error) throw result.error
  return result.data as VerificationRecord | null
}

async function saveVerification(db: ReturnType<typeof createServiceRoleClient>, purpose: Purpose, userId: string, session: Stripe.Identity.VerificationSession, method: Method) {
  const common = {
    user_id: userId,
    stripe_verification_session_id: session.id,
    status: session.status as IdentityStatus,
    last_error_code: session.last_error?.code || null,
    last_error_message: session.last_error ? 'Verification needs attention. Continue the secure verification flow.' : null,
    started_at: new Date().toISOString(),
    submitted_at: session.status === 'processing' ? new Date().toISOString() : null,
    verified_at: session.status === 'verified' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  const result = purpose === 'identity'
    ? await db.from('identity_verifications').upsert({ ...common, verification_method: method }, { onConflict: 'user_id' })
    : purpose === 'driver_license'
      ? await db.from('driver_license_verifications').upsert({ ...common, license_expires_on: null }, { onConflict: 'user_id' })
      : await db.from('driver_eligibility_identity_checks').upsert(common, { onConflict: 'user_id' })
  if (result.error) throw result.error
}

async function clearMissingSession(db: ReturnType<typeof createServiceRoleClient>, purpose: Purpose, userId: string) {
  const values = {
    stripe_verification_session_id: null,
    status: 'canceled' as const,
    last_error_code: 'resource_missing',
    last_error_message: null,
    updated_at: new Date().toISOString(),
  }
  const result = purpose === 'identity'
    ? await db.from('identity_verifications').update(values).eq('user_id', userId)
    : purpose === 'driver_license'
      ? await db.from('driver_license_verifications').update({ ...values, license_expires_on: null }).eq('user_id', userId)
      : await db.from('driver_eligibility_identity_checks').update(values).eq('user_id', userId)
  if (result.error) throw result.error
}

async function syncDriverLicenseExpiry(db: ReturnType<typeof createServiceRoleClient>, userId: string, record: VerificationRecord) {
  if (record.status !== 'verified' || record.license_expires_on || !record.stripe_verification_session_id || !identityResultsConfigured()) return record
  try {
    const expiresOn = await getVerifiedDriverLicenseExpiry(record.stripe_verification_session_id)
    if (!expiresOn) return record
    const { error } = await db.from('driver_license_verifications')
      .update({ license_expires_on: expiresOn, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) throw error
    return { ...record, license_expires_on: expiresOn }
  } catch {
    return record
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || user.is_anonymous) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })
    const purpose = parsePurpose(request.nextUrl.searchParams.get('purpose'))
    if (!purpose) return NextResponse.json({ error: 'Choose a supported verification purpose.' }, { status: 400 })

    const db = createServiceRoleClient()
    const [{ data: profile, error: profileError }, { data: account, error: accountError }] = await Promise.all([
      db.from('profiles').select('is_driver').eq('id', user.id).single(),
      db.from('account_details').select('country').eq('user_id', user.id).maybeSingle(),
    ])
    if (profileError || accountError) throw profileError || accountError
    if (purpose !== 'identity' && !profile.is_driver) return NextResponse.json({ error: 'Driver verification is only available for Driver accounts.' }, { status: 403 })

    let record = await readVerification(db, purpose, user.id)
    if (purpose === 'driver_license' && record) record = await syncDriverLicenseExpiry(db, user.id, record)
    const response = responseFor(record, purpose)
    const body = await response.json() as VerificationResponse
    return NextResponse.json({ ...body, isDriver: Boolean(profile.is_driver), country: account?.country || null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Identity verification is temporarily unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || user.is_anonymous) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })
    const text = await request.text()
    if (text.length > 4000) return NextResponse.json({ error: 'This request is too large.' }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'The request could not be read.' }, { status: 400 }) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'The request could not be read.' }, { status: 400 })
    const input = body as Record<string, unknown>
    const purpose = parsePurpose(typeof input.purpose === 'string' ? input.purpose : 'identity')
    const method = parseMethod(input.method)
    const context = input.context === 'driver_eligibility' ? 'driver_eligibility' : 'identity'
    if (!purpose || !method || (purpose === 'driver_license' && method !== 'document') || (purpose === 'driver_eligibility' && method !== 'id_number')) return NextResponse.json({ error: 'Choose a supported verification method.' }, { status: 400 })

    const db = createServiceRoleClient()
    const [{ data: preferences, error: preferenceError }, { data: profile, error: profileError }, { data: account, error: accountError }] = await Promise.all([
      db.from('account_preferences').select('account_state').eq('user_id', user.id).single(),
      db.from('profiles').select('is_driver').eq('id', user.id).single(),
      db.from('account_details').select('country').eq('user_id', user.id).maybeSingle(),
    ])
    if (preferenceError || profileError || accountError) throw preferenceError || profileError || accountError
    if (preferences.account_state !== 'active') return NextResponse.json({ error: 'Your account must be active to verify your identity.' }, { status: 403 })
    if (purpose !== 'identity' && !profile.is_driver) return NextResponse.json({ error: 'Driver verification is only available for Driver accounts.' }, { status: 403 })
    if (purpose === 'driver_eligibility' && context !== 'driver_eligibility') return NextResponse.json({ error: 'Start this verification from Driver Eligibility.' }, { status: 400 })
    if (method === 'id_number' && (purpose !== 'driver_eligibility' || !profile.is_driver || account?.country !== 'US')) {
      return NextResponse.json({ error: 'Stripe U.S. ID-number verification is available only in Driver Eligibility for U.S. Driver accounts.' }, { status: 400 })
    }

    let existing = await readVerification(db, purpose, user.id)
    if (existing?.status === 'verified') {
      if (purpose === 'driver_license') existing = await syncDriverLicenseExpiry(db, user.id, existing)
      return responseFor(existing, purpose)
    }

    const stripe = getIdentityStripe()
    if (existing?.stripe_verification_session_id && existing.status !== 'canceled') {
      let session: Stripe.Identity.VerificationSession | null = null
      try {
        session = await stripe.identity.verificationSessions.retrieve(existing.stripe_verification_session_id)
      } catch (error) {
        if (!isMissingVerificationSession(error)) throw error
        await clearMissingSession(db, purpose, user.id)
        existing = { ...existing, stripe_verification_session_id: null, status: 'canceled' }
      }
      if (session?.status === 'verified') {
        if (purpose === 'driver_license') {
          await saveVerification(db, purpose, user.id, session, 'document')
          existing = await readVerification(db, purpose, user.id)
          if (existing) existing = await syncDriverLicenseExpiry(db, user.id, existing)
        } else {
          await saveVerification(db, purpose, user.id, session, method)
          existing = await readVerification(db, purpose, user.id)
        }
        return responseFor(existing, purpose)
      }
      if (session?.status === 'processing') {
        const existingMethod = purpose === 'identity' ? existing.verification_method || method : 'document'
        await saveVerification(db, purpose, user.id, session, existingMethod)
        return responseFor({ ...existing, status: 'processing' }, purpose)
      }
      if (session?.status === 'requires_input') {
        const stripeType = method === 'id_number' ? 'id_number' : 'document'
        const options: Stripe.Identity.VerificationSessionUpdateParams.Options = method === 'document'
          ? { document: { allowed_types: purpose === 'driver_license' ? ['driving_license'] : ['driving_license', 'id_card', 'passport'] } }
          : {}
        const allowedTypes = session.options?.document?.allowed_types || []
        const documentOptionsMismatch = method === 'document' && (purpose === 'driver_license'
          ? !allowedTypes.includes('driving_license')
          : !allowedTypes.includes('passport') || !allowedTypes.includes('id_card'))
        if (session.type !== stripeType || documentOptionsMismatch) {
          session = await stripe.identity.verificationSessions.update(session.id, { type: stripeType, options })
        }
        await saveVerification(db, purpose, user.id, session, method)
        return responseFor(existing, purpose, session.client_secret)
      }
    }

    const stripeType = method === 'id_number' ? 'id_number' : 'document'
    const options: Stripe.Identity.VerificationSessionCreateParams.Options | undefined = method === 'document'
      ? { document: { allowed_types: purpose === 'driver_license' ? ['driving_license'] : ['driving_license', 'id_card', 'passport'] } }
      : undefined
    const { data: canStartSession, error: rateLimitError } = await db.rpc('claim_identity_session_slot', {
      p_user_id: user.id,
      p_purpose: purpose,
    })
    if (rateLimitError) throw rateLimitError
    if (!canStartSession) {
      return NextResponse.json(
        { error: 'Please wait a minute before starting another verification session.' },
        { status: 429, headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' } },
      )
    }
    const session = await stripe.identity.verificationSessions.create({
      type: stripeType,
      ...(options ? { options } : {}),
      provided_details: { email: user.email || undefined },
      client_reference_id: user.id,
      metadata: { user_id: user.id, purpose },
    }, { idempotencyKey: `seatbelt:identity:${user.id}:${purpose}:${method}:${Math.floor(Date.now() / 60000)}` })
    if (!session.client_secret) throw new Error('Verification could not be started.')
    await saveVerification(db, purpose, user.id, session, method)
    return responseFor({ stripe_verification_session_id: session.id, status: session.status, verification_method: method }, purpose, session.client_secret)
  } catch {
    return NextResponse.json({ error: 'Identity verification is temporarily unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
