import { NextResponse, type NextRequest } from 'next/server'
import { ensureAccount, readBody, recordAccountEvent, requireUser, RequestError, routeError } from '@/lib/platformServer'
import { BillingError, setAccountBillingPause, withBillingLock } from '@/lib/billing'

const notificationKeys = ['rider_messages_in_app','rider_messages_email','rider_messages_sms','driver_messages_in_app','driver_messages_email','driver_messages_sms','browser_alerts','newsletter','updates','promotions','payment_reminders']
const detailLimits: Record<string, number> = { legal_name: 32, address_line1: 200, address_line2: 200, city: 100, region: 100, postal_code: 20, country: 2, date_of_birth: 10, phone: 14, social_handle: 100, gender: 64 }

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const db = await ensureAccount(user.id)
    const results = await Promise.all([
      db.from('profiles').select('*').eq('id', user.id).single(),
      db.from('account_details').select('*').eq('user_id', user.id).single(),
      db.from('account_preferences').select('*').eq('user_id', user.id).single(),
      db.from('notification_preferences').select('*').eq('user_id', user.id).single(),
      db.from('identity_verifications').select('status,verified_at').eq('user_id', user.id).maybeSingle(),
      db.from('driver_license_verifications').select('status,license_expires_on').eq('user_id', user.id).maybeSingle(),
      db.from('driver_eligibility_identity_checks').select('status,verified_at').eq('user_id', user.id).maybeSingle(),
      db.from('driver_eligibility').select('overall_status,registration_expires_on,insurance_expires_on,registration_status,insurance_status').eq('user_id', user.id).maybeSingle(),
    ])
    for (const result of results) if (result.error) throw result.error
    const [profile,details,preferences,notifications,identity,driverLicense,driverIdentityCheck,eligibility] = results.map(result => result.data)
    let avatarUrl: string | null = null
    if (details?.avatar_path) {
      const { data, error } = await db.storage.from('account-portraits').createSignedUrl(details.avatar_path, 600)
      if (error) throw error
      avatarUrl = data.signedUrl
    }
    return NextResponse.json({ email: user.email || '', profile, details: { ...details, date_of_birth: details?.date_of_birth || '' }, preferences, notifications, identity, driverLicense, driverIdentityCheck, eligibility, avatarUrl }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return routeError(error) }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const body = await readBody(request)
    const db = await ensureAccount(user.id)
    const updates: {table:string;values:Record<string,unknown>}[] = []
    if (body.details !== undefined) {
      if (!body.details || typeof body.details !== 'object' || Array.isArray(body.details)) throw new RequestError('Enter valid profile details.')
      const details = body.details as Record<string,unknown>
      const row: Record<string,unknown> = {}
      for (const [key,value] of Object.entries(details)) {
        if (!(key in detailLimits) || typeof value !== 'string' || value.length > detailLimits[key]) throw new RequestError('A profile field contains an invalid value.')
        row[key] = value.trim()
      }
      const {data: previous,error} = await db.from('account_details').select('*').eq('user_id',user.id).single()
      if (error) throw error
      const all = {...previous,...row}
      for (const field of ['legal_name','address_line1','city','country','postal_code','date_of_birth']) if (!all[field]) throw new RequestError('Complete your legal name, address, city, country, postal code, and date of birth.')
      if (!/^[\p{L}\p{M}\p{N}' -]{1,32}$/u.test(all.legal_name) || all.legal_name.trim().split(/\s+/).length > 4) throw new RequestError('Legal name must contain 1–32 characters and no more than four name parts.')
      if (!/^[A-Z]{2}$/.test(all.country)) throw new RequestError('Use a two-letter country code, such as US.')
      if (all.country === 'US' && (!all.region || !/^\d{5}(-\d{4})?$/.test(all.postal_code))) throw new RequestError('Enter your state and a valid five-digit or ZIP+4 postal code.')
      const dob = new Date(`${all.date_of_birth}T00:00:00Z`)
      const adult = new Date(); adult.setUTCFullYear(adult.getUTCFullYear()-18)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(all.date_of_birth) || !Number.isFinite(dob.getTime()) || dob.toISOString().slice(0,10) !== all.date_of_birth || dob > adult || dob.getUTCFullYear() < 1900) throw new RequestError('Enter a valid date of birth. You must be at least 18.')
      if (all.gender && all.gender.length > detailLimits.gender) throw new RequestError('Gender must be at most 64 characters.')
      if (all.phone && !/^\(\d{3}\)-\d{3}-\d{4}$/.test(all.phone)) throw new RequestError('Enter a 10-digit U.S. phone number formatted as (XXX)-XXX-XXXX, or leave it empty.')
      updates.push({table:'account_details',values:row})
    }
    if (body.preferences !== undefined) {
      if (!body.preferences || typeof body.preferences !== 'object' || Array.isArray(body.preferences)) throw new RequestError('Enter valid preferences.')
      const input = body.preferences as Record<string,unknown>, row: Record<string,unknown> = {}
      for (const [key,value] of Object.entries(input)) {
        if (key === 'presence_status' && ['online','away','busy','offline'].includes(String(value))) row[key] = value
        else if (key === 'location_sharing' && value === false) row[key] = value
        else if (key === 'preferred_currency' && value === 'USD') row[key] = value
        else throw new RequestError('That preference is not available.')
      }
      updates.push({table:'account_preferences',values:row})
    }
    if (body.notifications !== undefined) {
      if (!body.notifications || typeof body.notifications !== 'object' || Array.isArray(body.notifications)) throw new RequestError('Choose valid notification preferences.')
      const row:Record<string,unknown> = {}
      for (const [key,value] of Object.entries(body.notifications)) {
        if (!notificationKeys.includes(key) || typeof value !== 'boolean') throw new RequestError('Choose valid notification preferences.')
        if (key.endsWith('_sms') && value) throw new RequestError('SMS alerts are not available yet. Choose email or in-app alerts.')
        row[key]=value
      }
      updates.push({table:'notification_preferences',values:row})
    }
    if (!updates.length) throw new RequestError('Choose a setting to update.')
    const {error: saveError} = await db.rpc('update_platform_account', {
      p_user_id: user.id,
      p_details: updates.find(update => update.table==='account_details')?.values ?? null,
      p_preferences: updates.find(update => update.table==='account_preferences')?.values ?? null,
      p_notifications: updates.find(update => update.table==='notification_preferences')?.values ?? null,
    })
    if(saveError) throw saveError
    return NextResponse.json({message:'Your changes are saved.'})
  } catch(error) {return routeError(error)}
}

export async function POST(request: NextRequest) {
  try {
    const user=await requireUser(request), body=await readBody(request), db=await ensureAccount(user.id)
    if (body.action==='heartbeat') {
      const {data:preferences,error:prefsError}=await db.from('account_preferences').select('last_seen_at,account_state').eq('user_id',user.id).single()
      if(prefsError) throw prefsError
      if(preferences.account_state!=='active') return NextResponse.json({ok:true})
      const last = preferences.last_seen_at ? new Date(preferences.last_seen_at).getTime() : 0
      if(Date.now()-last<60000) return NextResponse.json({ok:true})
      const {data:profile,error}=await db.from('profiles').select('last_session_mode').eq('id',user.id).single()
      if(error) throw error
      const {error:updateError}=await db.from('account_preferences').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id)
      if(updateError) throw updateError
      await recordAccountEvent(user.id,'activity',profile.last_session_mode==='driver'?'driver':'rider')
      return NextResponse.json({ok:true})
    }
    if(!['freeze','resume','request_deletion'].includes(String(body.action))) throw new RequestError('Choose a valid account action.')
    return await withBillingLock(`account-state:${user.id}`,async()=>{
    const {data:current,error:stateError}=await db.from('account_preferences').select('account_state').eq('user_id',user.id).single()
    if(stateError) throw stateError
    if(current.account_state==='deletion_requested') throw new RequestError('Your deletion request is awaiting review. Contact support to change this request.',409)
    const months=Number(body.months ?? 1)
    if(body.action==='freeze' && (!Number.isInteger(months)||months<1||months>6)) throw new RequestError('Choose a freeze duration of one to six months.')
    if(body.action==='request_deletion' && body.confirmation!=='DELETE') throw new RequestError('Type DELETE to confirm your deletion request.')
    const until=new Date(),day=until.getUTCDate();until.setUTCDate(1);until.setUTCMonth(until.getUTCMonth()+months)
    until.setUTCDate(Math.min(day,new Date(Date.UTC(until.getUTCFullYear(),until.getUTCMonth()+1,0)).getUTCDate()))
    // Pause billing first; a failed provider call must not claim payments stopped.
    const accountState=body.action==='resume'?'active':body.action==='freeze'?'frozen':'deletion_requested'
    async function finalize(){
      const {error}=await db.rpc('change_platform_account_state',{p_user_id:user.id,p_state:accountState,p_frozen_until:body.action==='freeze'?until.toISOString():null})
      if(error && body.action==='freeze') throw new RequestError('Subscription collection was paused, but your account freeze could not be saved. Reload your account and contact support before changing its status again.',503)
      if(error) throw error
    }
    const billingResult=body.action==='freeze'?await setAccountBillingPause(user.id,until.toISOString(),finalize):body.action==='resume'?await setAccountBillingPause(user.id,null,finalize):null
    if(body.action==='request_deletion')await withBillingLock(`user:${user.id}`,finalize)
    return NextResponse.json({message:body.action==='request_deletion'?'Your deletion request is recorded. Review and required retention checks must finish before data is deleted. Billing cancellation is managed separately under Subscription.':body.action==='freeze'?billingResult?.status==='no_subscription'?'Your account is frozen. No subscription was found to pause. Reactivation is processed after your selected return date.':'Your account is frozen and subscription collection is confirmed paused. Reactivation is processed after your selected return date.':'Your account is active again.'})
    })
  }catch(error){return routeError(error instanceof BillingError?new RequestError(error.message,error.status):error)}
}
