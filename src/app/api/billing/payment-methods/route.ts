import { NextRequest, NextResponse } from 'next/server'
import { BillingError, billingBody, billingResponse, billingUrl, billingUser, ensureBillingCustomer, getBillingStripe, requireActiveAccount, withBillingLock } from '@/lib/billing'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const user = await billingUser(request, true)
    const { kind } = await billingBody(request)
    if (kind !== 'card' && kind !== 'bank') throw new BillingError('Choose a card or bank account.', 400)
    if (kind === 'bank' && process.env.STRIPE_BANK_PAYMENTS_ENABLED !== 'true') throw new BillingError('Bank account payments are not configured yet.')
    const session = await withBillingLock(`user:${user.id}`, async () => {
      await requireActiveAccount(user.id)
      const customer = await ensureBillingCustomer(user.id)
      return getBillingStripe().checkout.sessions.create({ mode: 'setup', customer, currency: 'usd',
        payment_method_types: kind === 'bank' ? ['us_bank_account'] : ['card'],
        success_url: billingUrl('/profile/settings/payment?returned=setup'), cancel_url: billingUrl('/profile/settings/payment?returned=canceled'),
      })
    })
    if (!session.url) throw new BillingError('Payment setup is temporarily unavailable.')
    return NextResponse.json({ url: session.url })
  } catch (error) { return billingResponse(error) }
}
