import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  loading: boolean
}

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(async <T>(
    operation: () => Promise<{ data: T | null; error: any }>
  ): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: apiError } = await operation()
      
      if (apiError) {
        setError(apiError.message || 'An error occurred')
        return null
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { request, loading, error }
}

export function useDriverMutations() {
  const { request, loading, error } = useApi()

  const updateDriverStatus = useCallback(async (
    driverId: string, 
    status: 'available' | 'busy' | 'offline'
  ) => {
    return request(async () => {
      return await supabase
        .from('user_profiles')
        .update({ availability_status: status })
        .eq('id', driverId)
        .select()
        .single()
    })
  }, [request])

  const updateDriverLocation = useCallback(async (
    driverId: string, 
    location: { latitude: number; longitude: number }
  ) => {
    return request(async () => {
      return await supabase
        .from('user_profiles')
        .update({ 
          current_location: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          }
        })
        .eq('id', driverId)
        .select()
        .single()
    })
  }, [request])

  const assignOrder = useCallback(async (orderId: string, driverId: string) => {
    return request(async () => {
      return await supabase
        .from('orders')
        .update({ 
          assigned_driver_id: driverId,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single()
    })
  }, [request])

  return {
    updateDriverStatus,
    updateDriverLocation,
    assignOrder,
    loading,
    error
  }
}

export function useRouteMutations() {
  const { request, loading, error } = useApi()

  const createRoute = useCallback(async (routeData: any) => {
    return request(async () => {
      return await supabase
        .from('routes')
        .insert([routeData])
        .select()
        .single()
    })
  }, [request])

  const updateRoute = useCallback(async (routeId: string, updates: any) => {
    return request(async () => {
      return await supabase
        .from('routes')
        .update(updates)
        .eq('id', routeId)
        .select()
        .single()
    })
  }, [request])

  const deleteRoute = useCallback(async (routeId: string) => {
    return request(async () => {
      return await supabase
        .from('routes')
        .delete()
        .eq('id', routeId)
    })
  }, [request])

  const assignDriver = useCallback(async (routeId: string, driverId: string) => {
    return request(async () => {
      return await supabase
        .from('routes')
        .update({ driver_id: driverId })
        .eq('id', routeId)
        .select()
        .single()
    })
  }, [request])

  return {
    createRoute,
    updateRoute,
    deleteRoute,
    assignDriver,
    loading,
    error
  }
}

export function useOrderMutations() {
  const { request, loading, error } = useApi()

  const createOrder = useCallback(async (orderData: any) => {
    return request(async () => {
      return await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single()
    })
  }, [request])

  const updateOrder = useCallback(async (orderId: string, updates: any) => {
    return request(async () => {
      return await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single()
    })
  }, [request])

  const updateOrderStatus = useCallback(async (
    orderId: string, 
    status: string,
    notes?: string
  ) => {
    return request(async () => {
      const updates: any = { 
        status,
        updated_at: new Date().toISOString()
      }
      
      if (notes) {
        updates.delivery_notes = notes
      }

      return await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single()
    })
  }, [request])

  return {
    createOrder,
    updateOrder,
    updateOrderStatus,
    loading,
    error
  }
}

// Default export
export default useApi
