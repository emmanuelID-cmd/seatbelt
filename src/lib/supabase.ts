import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'seatbelt-auth',
  }
})

export type Profile = {
  id: string
  full_name: string
  avatar_initials: string
  car_make: string
  car_model: string
  car_year: string
  rating: number
  total_rides: number
  is_driver: boolean
}

export type Trip = {
  id: string
  driver_id: string | null
  rider_id: string | null
  post_type: 'driver' | 'rider'
  origin: string | null
  destination: string | null
  departure_time: string | null
  seats_available: number
  suggested_price: string | null
  price_min: number | null
  price_max: number | null
  currency_code: string
  notes: string | null
  is_active: boolean
  created_at: string
  profiles?: Profile
  rider_profile?: Profile
}

export type Message = {
  id: string
  trip_id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  profiles?: Profile
}