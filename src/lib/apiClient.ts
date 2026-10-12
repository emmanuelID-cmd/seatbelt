import { supabase } from '@/lib/supabase'

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('No internet access. Reconnect and try again.')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in again to continue.')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...options, headers, cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Temporarily unavailable. Please try again.')
  return data as T
}
