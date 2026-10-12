import 'server-only'
import {createServiceRoleClient} from '@/lib/supabaseServer'
import {setAccountBillingPause,withBillingLock} from '@/lib/billing'
import {notifyAccount} from '@/lib/platformServer'

export async function maintainPlatformAccounts(){
  const db=createServiceRoleClient(),now=new Date().toISOString()
  const {data:due,error}=await db.from('account_preferences').select('user_id,frozen_until').eq('account_state','frozen').lte('frozen_until',now).order('frozen_until').limit(20)
  if(error)throw error
  let resumed=0,failed=0
  const deadline=Date.now()+60000
  for(const account of due||[]){
    if(Date.now()>=deadline)break
    try{
      await withBillingLock(`account-state:${account.user_id}`,async()=>{
        const {data:current,error:readError}=await db.from('account_preferences').select('account_state,frozen_until').eq('user_id',account.user_id).single()
        if(readError)throw readError
        if(current.account_state!=='frozen'||!current.frozen_until||current.frozen_until>now)return
        await setAccountBillingPause(account.user_id,null,async()=>{
          const {error:saveError}=await db.rpc('change_platform_account_state',{p_user_id:account.user_id,p_state:'active',p_frozen_until:null})
          if(saveError)throw saveError
        })
        resumed++
      })
    }catch{failed++}
  }
  const {data:subscriptions,error:subscriptionError}=await db.from('billing_subscriptions').select('user_id,renewal_at').in('status',['active','trialing']).eq('cancel_at_period_end',false).is('frozen_until',null).gt('renewal_at',now).lte('renewal_at',new Date(Date.now()+7*86400000).toISOString()).limit(100)
  if(subscriptionError)throw subscriptionError
  let reminders=0
  for(const subscription of subscriptions||[]){
    const {data:prefs,error:prefsError}=await db.from('notification_preferences').select('payment_reminders').eq('user_id',subscription.user_id).maybeSingle()
    const {data:account,error:accountError}=await db.from('account_preferences').select('account_state').eq('user_id',subscription.user_id).maybeSingle()
    if(prefsError||accountError)throw prefsError||accountError
    if(!prefs?.payment_reminders||account?.account_state!=='active')continue
    await notifyAccount(subscription.user_id,'payment','Subscription renewal approaching','Your subscription is scheduled to renew within seven days. Check Subscription for provider-confirmed status, terms and cancellation options.',true,`renewal:${subscription.user_id}:${subscription.renewal_at}`)
    reminders++
  }
  return {resumed,failed,reminders,deferred:Math.max(0,(due?.length||0)-resumed-failed)}
}
