import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

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
      last_error_message: lastError?.reason || null,
      submitted_at: status === 'processing' ? new Date().toISOString() : null,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await createServiceRoleClient()
      .from('identity_verifications')
      .update(updates)
      .eq('stripe_verification_session_id', session.id)
    if (error) throw error

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, { status: 400 })
  }
}