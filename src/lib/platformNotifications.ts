import 'server-only'
import {createServiceRoleClient} from '@/lib/supabaseServer'

type Delivery={id:string;user_id:string;attempt_count:number;category?:string}
export async function deliverPlatformNotifications(){
  const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL
  if(!apiKey||!from)return {available:false,sent:0,failed:0}
  const db=createServiceRoleClient();let sent=0,failed=0
  for(const source of ['eligibility','account']){
    const {data,error}=await db.rpc('claim_platform_notifications',{p_source:source})
    if(error)throw error
    for(const event of (data||[]) as Delivery[]){
      const table=source==='account'?'user_notifications':'driver_eligibility_notification_events'
      const statusKey=source==='account'?'delivery_status':'status'
      try{
        const {data:user,error:userError}=await db.auth.admin.getUserById(event.user_id)
        if(userError||!user.user?.email||!user.user.email_confirmed_at)throw new Error('Recipient unavailable')
        // Never copy private notification bodies, documents, reasons or request messages into email.
        const response=await fetch('https://api.resend.com/emails',{
          method:'POST',signal:AbortSignal.timeout(10000),
          headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`seatbelt/${source}/${event.id}`},
          body:JSON.stringify({from,to:[user.user.email],subject:'A Seatbelt account update is available',text:'An update is available in your Seatbelt account. Open Seatbelt and sign in to review your notifications. Detailed information is available only after you sign in.'}),
        })
        if(!response.ok)throw new Error('Delivery unavailable')
        const values:Record<string,unknown>={[statusKey]:'sent',delivery_claimed_at:null}
        if(source==='account')values.delivered_at=new Date().toISOString()
        else {values.sent_at=new Date().toISOString();values.last_error=null;values.updated_at=new Date().toISOString()}
        const saved=await db.from(table).update(values).eq('id',event.id).eq(statusKey,'processing').eq('attempt_count',event.attempt_count)
        if(saved.error)throw saved.error
        sent++
      }catch{
        const values:Record<string,unknown>={[statusKey]:'failed',delivery_claimed_at:null,next_attempt_at:new Date(Date.now()+Math.min(1440,5*2**(event.attempt_count-1))*60000).toISOString()}
        if(source==='eligibility'){values.last_error='Notification delivery unavailable.';values.updated_at=new Date().toISOString()}
        const saved=await db.from(table).update(values).eq('id',event.id).eq(statusKey,'processing').eq('attempt_count',event.attempt_count)
        if(saved.error)throw saved.error
        failed++
      }
    }
  }
  return {available:true,sent,failed}
}
