import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient, getAuthenticatedUser } from '@/lib/supabaseServer'

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export async function requireUser(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user || user.is_anonymous) throw new RequestError('Please sign in again to continue.', 401)
  return user
}
export async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.length > 20000) throw new RequestError('This request is too large.', 413)
  let body: unknown
  try { body = JSON.parse(text) } catch { throw new RequestError('The request could not be read.') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('The request could not be read.')
  return body as Record<string, unknown>
}
export function routeError(error: unknown) {
  return NextResponse.json({ error: error instanceof RequestError ? error.message : 'Temporarily unavailable. Please try again.' }, { status: error instanceof RequestError ? error.status : 503,headers:{'Cache-Control':'private, no-store'} })
}
export async function ensureAccount(userId: string) {
  const db = createServiceRoleClient()
  for (const table of ['account_details', 'account_preferences', 'notification_preferences']) {
    const { error } = await db.from(table).upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (error) throw error
  }
  return db
}
export async function recordAccountEvent(userId: string, eventType: string, mode?: 'rider' | 'driver') {
  const { error } = await createServiceRoleClient().from('account_events').insert({ user_id: userId, event_type: eventType, mode: mode || null })
  if (error) throw error
}
export async function notifyAccount(userId: string, category: 'security' | 'account' | 'ride' | 'payment' | 'support' | 'update', title: string, body: string, emailRequired = true, dedupeKey?: string) {
  const db = createServiceRoleClient()
  const row = { user_id: userId, category, title, body, email_required: emailRequired, dedupe_key: dedupeKey || null }
  const { error } = dedupeKey ? await db.from('user_notifications').upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true }) : await db.from('user_notifications').insert(row)
  if (error) throw error
}
