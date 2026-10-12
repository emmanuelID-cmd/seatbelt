import { NextRequest, NextResponse } from 'next/server'
import { BillingError, billingAccount, billingResponse, billingUrl, billingUser, getBillingStripe } from '@/lib/billing'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const user = await billingUser(request)
    const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID
    if (!configuration) throw new BillingError('Payment method management is not configured yet.')
    const account = await billingAccount(user.id)
    if (!account?.customer_id) throw new BillingError('Add a payment method or subscription first.', 409)
    const stripe = getBillingStripe()
    const settings = await stripe.billingPortal.configurations.retrieve(configuration)
    if (!settings.active || !settings.features.payment_method_update.enabled || settings.features.subscription_update.enabled) {
      throw new BillingError('Hosted payment management is not configured correctly. Please contact support.')
    }
    const portal = await stripe.billingPortal.sessions.create({ customer: account.customer_id, configuration,
      return_url: billingUrl('/profile/settings/payment') })
    return NextResponse.json({ url: portal.url })
  } catch (error) { return billingResponse(error) }
}
