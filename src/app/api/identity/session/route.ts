import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, getAuthenticatedUser } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

type IdentityStatus = 'requires_input' | 'processing' | 'verified' | 'canceled'

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('Stripe is temporarily unavailable. Please try again later.')
  return new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' })
}

function responseForStatus(status: IdentityStatus, clientSecret?: string | null) {
  return NextResponse.json({ status, clientSecret: clientSecret || undefined })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })

    const { data, error } = await createServiceRoleClient()
      .from('identity_verifications')
      .select('status, started_at, submitted_at, verified_at, last_error_message')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error

    return NextResponse.json({ verification: data || null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Identity verification is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })

    const serviceClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await serviceClient
      .from('identity_verifications')
      .select('stripe_verification_session_id, status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing?.status === 'verified') return responseForStatus('verified')

    const stripe = getStripe()
    if (existing?.stripe_verification_session_id && existing.status !== 'canceled') {
      const session = await stripe.identity.verificationSessions.retrieve(existing.stripe_verification_session_id)
      if (session.status === 'verified') return responseForStatus('verified')
      if (session.status === 'processing') return responseForStatus('processing')
      if (session.client_secret) return responseForStatus('requires_input', session.client_secret)
    }

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      provided_details: { email: user.email || undefined },
      metadata: { user_id: user.id },
    })
    if (!session.client_secret) throw new Error('Verification could not be started. Please try again.')

    const { error: saveError } = await serviceClient.from('identity_verifications').upsert({
      user_id: user.id,
      stripe_verification_session_id: session.id,
      status: 'requires_input',
      last_error_code: null,
      last_error_message: null,
      started_at: new Date().toISOString(),
      submitted_at: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    })
    if (saveError) throw saveError

    return responseForStatus('requires_input', session.client_secret)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Identity verification is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}