import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'
import { requireUser, routeError } from '@/lib/platformServer'

export async function GET(request: NextRequest) {
  try {
    const user=await requireUser(request), db=createServiceRoleClient()
    const results=await Promise.all([
      db.from('profiles').select('*').eq('id',user.id).maybeSingle(),
      db.from('account_details').select('legal_name,address_line1,address_line2,city,region,postal_code,country,date_of_birth,phone,social_handle,gender').eq('user_id',user.id).maybeSingle(),
      db.from('account_preferences').select('presence_status,account_state,frozen_until,preferred_currency,location_sharing').eq('user_id',user.id).maybeSingle(),
      db.from('notification_preferences').select('*').eq('user_id',user.id).maybeSingle(),
      db.from('support_tickets').select('category,subject,message,status,response,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1000),
      db.from('rides').select('id,trip_id,driver_id,rider_id,amount_cents,currency_code,status,created_at,started_at,completed_at,canceled_at,distance_meters').or(`driver_id.eq.${user.id},rider_id.eq.${user.id}`).order('created_at',{ascending:false}).limit(1000),
    ])
    for(const result of results)if(result.error)throw result.error
    const [profile,details,preferences,notifications,tickets,rides]=results.map(result=>result.data)
    return NextResponse.json({generated_at:new Date().toISOString(),email:user.email,profile,details,preferences,notifications,tickets,rides,coverage:'Account details and up to 1,000 most recent rides/support requests. Request an extended export through Privacy support for older records or additional data categories.'},{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="seatbelt-account-export.json"'}})
  } catch(error){return routeError(error)}
}
