import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client with service role key
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Server-side Supabase client with cookie support
export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

// Types
export interface UserProfile {
  id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: 'super_admin' | 'admin' | 'driver'
  availability_status?: 'available' | 'busy' | 'offline'
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  pickup_address: string
  delivery_address: string
  delivery_notes?: string
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  driver_id?: string
  route_id?: string
  shopify_order_id?: string
  estimated_delivery_time?: string
  assigned_at?: string
  coordinates?: [number, number]
  created_by: string
  created_at: string
  updated_at: string
}

export interface OrderUpdate {
  id: string
  order_id: string
  driver_id?: string
  status: string
  notes?: string
  photo_url?: string
  latitude?: number
  longitude?: number
  created_at: string
}

export interface Route {
  id: string
  route_number: string
  route_name: string
  driver_id?: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  total_stops: number
  total_distance?: number
  estimated_duration?: number
  actual_duration?: number
  created_by: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

export interface RouteStop {
  id: string
  route_id: string
  order_id: string
  sequence_order: number
  estimated_arrival_time?: string
  actual_arrival_time?: string
  status: 'pending' | 'completed' | 'skipped'
  notes?: string
}

// Default export
export default supabase
