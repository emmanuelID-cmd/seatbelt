import type { Message, Trip } from '@/lib/supabase'

export type Ride = {
  id: string; trip_id: string; driver_id: string; rider_id: string
  amount_cents: number; currency_code: string
  status: 'accepted' | 'in_progress' | 'completed' | 'canceled'
  created_at: string; started_at: string | null; completed_at: string | null; canceled_at: string | null
  distance_meters: number | null; route_coordinates: unknown | null
  trip?: Trip | null; reviewed?: boolean
}
export type RideOffer = {
  id: string; trip_id: string; driver_id: string; rider_id: string; amount_cents: number
  currency_code: string; status: 'pending' | 'accepted' | 'superseded'; created_at: string
}
export type RideSession = { userId: string; mode: 'rider' | 'driver'; driverEligible: boolean; accountRole: string | null }
export type Conversation = {
  trip: Trip; other: { id: string; full_name: string | null }; userId: string
  messages: Message[]; offers: RideOffer[]; ride: Ride | null; isDriver: boolean
}
export type PostInput = {
  origin: string; destination: string; departure_time: string | null
  seats_available: number; price_min: number | null; price_max: number | null; notes: string
}
export function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}
export function offerCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null
  const cents = Math.round(Number(value) * 100)
  return Number.isSafeInteger(cents) && cents >= 100 && cents <= 99900 ? cents : null
}
export function postErrors(input: PostInput, mode: 'rider' | 'driver'): Record<string, string> {
  const errors: Record<string, string> = {}
  if ((mode === 'rider' && !input.origin.trim()) || input.origin.length > 200) errors.origin = 'Enter a departure location of up to 200 characters.'
  if ((mode === 'rider' && !input.destination.trim()) || input.destination.length > 200) errors.destination = 'Enter an arrival location of up to 200 characters.'
  if (mode === 'rider' && input.departure_time !== null && (!Number.isFinite(Date.parse(input.departure_time)) || Date.parse(input.departure_time) <= Date.now())) errors.departure_time = 'Choose a future departure date and time, or Present.'
  if (!Number.isInteger(input.seats_available) || input.seats_available < 1 || input.seats_available > 4) errors.seats_available = 'Seats must be a whole number from 1 to 4.'
  if (mode === 'rider') {
    if (input.price_min === null || offerCents(String(input.price_min)) === null) errors.price_min = 'Minimum estimate must be $1.00–$999.00 with up to two decimal places.'
    if (input.price_max === null || offerCents(String(input.price_max)) === null) errors.price_max = 'Maximum estimate must be $1.00–$999.00 with up to two decimal places.'
    if (input.price_min !== null && input.price_max !== null && input.price_min > input.price_max) errors.price_max = 'Maximum estimate must be at least the minimum estimate.'
  }
  if (Array.from(input.notes).length > 280) errors.notes = 'Notes can be up to 280 characters.'
  return errors
}
