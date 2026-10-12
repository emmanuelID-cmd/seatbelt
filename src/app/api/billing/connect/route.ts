import { NextRequest, NextResponse } from 'next/server'
import { BillingError, billingAccount, billingResponse, billingUrl, billingUser, getBillingStripe, requireEligibleDriver, withBillingLock } from '@/lib/billing'
import { createServiceRoleClient } from '@/lib/supabaseServer'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const user = await billingUser(request, true)
    await requireEligibleDriver(user.id)
    if (process.env.STRIPE_CONNECT_ENABLED !== 'true') throw new BillingError('Driver payouts are not configured yet.')
    const result = await withBillingLock(`user:${user.id}`, async () => {
      await requireEligibleDriver(user.id)
      const stripe = getBillingStripe()
      let accountId = (await billingAccount(user.id))?.connect_account_id
      if (!accountId) {
        const account = await stripe.accounts.create({ type: 'express', country: 'US',
          capabilities: { transfers: { requested: true } }, metadata: { seatbelt_user_id: user.id } },
        { idempotencyKey: `seatbelt:connect:${user.id}` })
        accountId = account.id
        const { error } = await createServiceRoleClient().from('billing_accounts').upsert({ user_id: user.id, connect_account_id: accountId }, { onConflict: 'user_id' })
        if (error) throw error
      }
      return stripe.accountLinks.create({ account: accountId, type: 'account_onboarding',
        refresh_url: billingUrl('/profile/settings/payment?returned=connect_expired'),
        return_url: billingUrl('/profile/settings/payment?returned=connect') })
    })
    return NextResponse.json({ url: result.url })
  } catch (error) { return billingResponse(error) }
}
