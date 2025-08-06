import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserProfile, Order, Route } from '@/lib/supabase'

// Custom hook for fetching orders
export function useOrders(filters?: { status?: string; driver_id?: string; search?: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrders() {
      try {
        setLoading(true)
        let query = supabase
          .from('orders')
          .select(`
            *,
            driver:user_profiles!orders_assigned_driver_id_fkey(
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
          query = query.eq('assigned_driver_id', filters.driver_id)
        }

        if (filters?.search) {
          query = query.or(`order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`)
        }

        const { data, error } = await query

        if (error) throw error

        setOrders(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch orders')
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [filters?.status, filters?.driver_id, filters?.search])

  return { orders, loading, error, refetch: () => fetchOrders() }
}

// Custom hook for fetching drivers
export function useDrivers(filters?: { availability_status?: string; is_active?: boolean }) {
  const [drivers, setDrivers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDrivers() {
      try {
        setLoading(true)
        let query = supabase
          .from('user_profiles')
          .select('*')
          .eq('role', 'driver')
          .order('first_name', { ascending: true })

        if (filters?.availability_status) {
          query = query.eq('availability_status', filters.availability_status)
        }

        if (filters?.is_active !== undefined) {
          query = query.eq('is_active', filters.is_active)
        }

        const { data, error } = await query

        if (error) throw error

        setDrivers(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch drivers')
      } finally {
        setLoading(false)
      }
    }

    fetchDrivers()
  }, [filters?.availability_status, filters?.is_active])

  return { drivers, loading, error, refetch: () => fetchDrivers() }
}

// Custom hook for fetching routes
export function useRoutes(filters?: { status?: string; driver_id?: string }) {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRoutes() {
      try {
        setLoading(true)
        let query = supabase
          .from('routes')
          .select(`
            *,
            driver:user_profiles!routes_driver_id_fkey(
              id,
              first_name,
              last_name,
              email
            ),
            route_stops(
              id,
              order_id,
              sequence_order,
              status,
              orders(
                id,
                order_number,
                customer_name,
                delivery_address
              )
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

        setRoutes(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch routes')
      } finally {
        setLoading(false)
      }
    }

    fetchRoutes()
  }, [filters?.status, filters?.driver_id])

  return { routes, loading, error, refetch: () => fetchRoutes() }
}

// Custom hook for driver mutations
export function useDriverMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateDriverStatus = async (driverId: string, status: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('user_profiles')
        .update({ availability_status: status })
        .eq('id', driverId)

      if (error) throw error

      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update driver status'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const assignOrderToDriver = async (orderId: string, driverId: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('orders')
        .update({ 
          assigned_driver_id: driverId,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (error) throw error

      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign order'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  return {
    updateDriverStatus,
    assignOrderToDriver,
    loading,
    error
  }
}

// Custom hook for route mutations
export function useRouteMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createRoute = async (routeData: Partial<Route>) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('routes')
        .insert([routeData])
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create route'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const updateRoute = async (routeId: string, updates: Partial<Route>) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('routes')
        .update(updates)
        .eq('id', routeId)
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update route'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const deleteRoute = async (routeId: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', routeId)

      if (error) throw error

      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete route'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  return {
    createRoute,
    updateRoute,
    deleteRoute,
    loading,
    error
  }
}
