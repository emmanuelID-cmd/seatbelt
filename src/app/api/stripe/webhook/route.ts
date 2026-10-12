import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'
import { getVerifiedDriverLicenseExpiry } from '@/lib/stripeIdentity'

export const runtime = 'nodejs'

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('Stripe configuration is missing.')
  return new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' })
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')
  if (!webhookSecret || !signature) return NextResponse.json({ error: 'Invalid webhook request.' }, { status: 400 })

  try {
    const event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret)
    if (!event.type.startsWith('identity.verification_session.')) return NextResponse.json({ received: true })

    const session = event.data.object as Stripe.Identity.VerificationSession
    const status = session.status
    if (!['requires_input', 'processing', 'verified', 'canceled'].includes(status)) return NextResponse.json({ received: true })

    const lastError = session.last_error
    const updates = {
      status,
      last_error_code: lastError?.code || null,
      last_error_message: lastError ? 'Verification needs attention. Continue the secure verification flow.' : null,
      submitted_at: status === 'processing' ? new Date().toISOString() : null,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    const db = createServiceRoleClient()
    const [identityResult, licenseResult, eligibilityIdentityResult] = await Promise.all([
      db.from('identity_verifications').update(updates).eq('stripe_verification_session_id', session.id),
      db.from('driver_license_verifications').update(updates).eq('stripe_verification_session_id', session.id).select('user_id'),
      db.from('driver_eligibility_identity_checks').update(updates).eq('stripe_verification_session_id', session.id),
    ])
    if (identityResult.error) throw identityResult.error
    if (licenseResult.error) throw licenseResult.error
    if (eligibilityIdentityResult.error) throw eligibilityIdentityResult.error
    if (status === 'verified' && licenseResult.data?.length) {
      try {
        const expiry = await getVerifiedDriverLicenseExpiry(session.id)
        if (expiry) {
          const { error } = await db.from('driver_license_verifications')
            .update({ license_expires_on: expiry, updated_at: new Date().toISOString() })
            .eq('stripe_verification_session_id', session.id)
          if (error) throw error
        }
      } catch {
        // Verification remains recorded; Driver mode stays unavailable until
        // restricted result access supplies the license expiration date.
      }
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 400 })
  }
}
