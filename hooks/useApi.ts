import { useState, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabase-client'

export interface Driver {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  availability_status: 'available' | 'busy' | 'offline'
  created_at: string
  updated_at: string
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
  created_by: string
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  delivery_address: string
  status: string
  priority: string
  created_at: string
  updated_at: string
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export interface MutationResponse {
  success: boolean
  error: string | null
  loading: boolean
}

// Custom hook for driver operations
export function useDriverMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createDriver = useCallback(async (driverData: Partial<Driver>) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: supabaseError } = await supabaseClient
        .from('user_profiles')
        .insert([{
          ...driverData,
          role: 'driver',
          availability_status: 'available'
        }])
        .select()
        .single()

      if (supabaseError) throw supabaseError

      setLoading(false)
      return { success: true, data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, data: null, error: errorMessage }
    }
  }, [])

  const updateDriver = useCallback(async (driverId: string, updates: Partial<Driver>) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: supabaseError } = await supabaseClient
        .from('user_profiles')
        .update(updates)
        .eq('id', driverId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      setLoading(false)
      return { success: true, data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, data: null, error: errorMessage }
    }
  }, [])

  const deleteDriver = useCallback(async (driverId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const { error: supabaseError } = await supabaseClient
        .from('user_profiles')
        .delete()
        .eq('id', driverId)

      if (supabaseError) throw supabaseError

      setLoading(false)
      return { success: true, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, error: errorMessage }
    }
  }, [])

  const updateAvailability = useCallback(async (driverId: string, status: Driver['availability_status']) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: supabaseError } = await supabaseClient
        .from('user_profiles')
        .update({ availability_status: status })
        .eq('id', driverId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      setLoading(false)
      return { success: true, data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, data: null, error: errorMessage }
    }
  }, [])

  return {
    createDriver,
    updateDriver,
    deleteDriver,
    updateAvailability,
    loading,
    error
  }
}

// Custom hook for route operations
export function useRouteMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createRoute = useCallback(async (routeData: {
    route_name: string
    driver_id?: string
    order_ids: string[]
    created_by: string
  }) => {
    setLoading(true)
    setError(null)
    
    try {
      // Generate route number
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const { count } = await supabaseClient
        .from('routes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0])

      const routeNumber = `RT${today}${String((count || 0) + 1).padStart(3, '0')}`

      // Create the route
      const { data: route, error: routeError } = await supabaseClient
        .from('routes')
        .insert([{
          route_number: routeNumber,
          route_name: routeData.route_name,
          driver_id: routeData.driver_id,
          status: 'planned',
          total_stops: routeData.order_ids.length,
          created_by: routeData.created_by
        }])
        .select()
        .single()

      if (routeError) throw routeError

      // Create route stops
      if (routeData.order_ids.length > 0) {
        const stops = routeData.order_ids.map((orderId, index) => ({
          route_id: route.id,
          order_id: orderId,
          sequence_order: index + 1,
          status: 'pending'
        }))

        const { error: stopsError } = await supabaseClient
          .from('route_stops')
          .insert(stops)

        if (stopsError) throw stopsError

        // Update orders with route assignment
        const { error: ordersError } = await supabaseClient
          .from('orders')
          .update({ 
            route_id: route.id,
            status: 'assigned'
          })
          .in('id', routeData.order_ids)

        if (ordersError) throw ordersError
      }

      setLoading(false)
      return { success: true, data: route, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, data: null, error: errorMessage }
    }
  }, [])

  const updateRoute = useCallback(async (routeId: string, updates: Partial<Route>) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: supabaseError } = await supabaseClient
        .from('routes')
        .update(updates)
        .eq('id', routeId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      setLoading(false)
      return { success: true, data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, data: null, error: errorMessage }
    }
  }, [])

  const deleteRoute = useCallback(async (routeId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // First, unassign orders from the route
      await supabaseClient
        .from('orders')
        .update({ 
          route_id: null,
          status: 'pending'
        })
        .eq('route_id', routeId)

      // Delete route stops
      await supabaseClient
        .from('route_stops')
        .delete()
        .eq('route_id', routeId)

      // Delete the route
      const { error: supabaseError } = await supabaseClient
        .from('routes')
        .delete()
        .eq('id', routeId)

      if (supabaseError) throw supabaseError

      setLoading(false)
      return { success: true, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, error: errorMessage }
    }
  }, [])

  const assignDriver = useCallback(async (routeId: string, driverId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: supabaseError } = await supabaseClient
        .from('routes')
        .update({ driver_id: driverId })
        .eq('id', routeId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Update driver availability
      await supabaseClient
        .from('user_profiles')
        .update({ availability_status: 'busy' })
        .eq('id', driverId)

      setLoading(false)
      return { success: true, data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
      return { success: false, data: null, error: errorMessage }
    }
  }, [])

  return {
    createRoute,
    updateRoute,
    deleteRoute,
    assignDriver,
    loading,
    error
  }
}

// General API hook for fetching data
export function useApi<T>(
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await fetcher()
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, dependencies)

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}

// Fetch drivers
export function useDrivers() {
  return useApi(async () => {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('role', 'driver')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as Driver[]
  })
}

// Fetch routes
export function useRoutes(filters?: {
  status?: string
  driver_id?: string
}) {
  return useApi(async () => {
    let query = supabaseClient
      .from('routes')
      .select(`
        *,
        user_profiles!routes_driver_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.driver_id) {
      query = query.eq('driver_id', filters.driver_id)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Route[]
  }, [filters])
}

// Fetch orders
export function useOrders(filters?: {
  status?: string
  driver_id?: string
}) {
  return useApi(async () => {
    let query = supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.driver_id) {
      query = query.eq('driver_id', filters.driver_id)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Order[]
  }, [filters])
}
