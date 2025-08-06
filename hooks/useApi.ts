import { useState, useEffect, useCallback } from 'react'
import { API, Order, Driver, Route } from '@/lib/api'

// Generic hook for API calls
export function useApiCall<T>(
  apiCall: () => Promise<{ data: T; error: string | null }>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await apiCall()
      
      if (result.error) {
        setError(result.error)
        setData(null)
      } else {
        setData(result.data)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// Specific hooks for different data types
export function useOrders(filters?: Parameters<typeof API.getOrders>[0]) {
  // Try the full query first, fallback to simple if it fails
  const [useSimple, setUseSimple] = useState(false)
  
  const result = useApiCall(
    () => useSimple ? API.getOrdersSimple() : API.getOrders(filters),
    [JSON.stringify(filters), useSimple]
  )

  // If we get a relationship error, switch to simple mode
  useEffect(() => {
    if (result.error && result.error.includes('relationship') && !useSimple) {
      console.warn('Falling back to simple orders query due to relationship error')
      setUseSimple(true)
    }
  }, [result.error, useSimple])

  return result
}

export function useDrivers(filters?: Parameters<typeof API.getDrivers>[0]) {
  return useApiCall(
    () => API.getDrivers(filters),
    [JSON.stringify(filters)]
  )
}

export function useRoutes(filters?: Parameters<typeof API.getRoutes>[0]) {
  return useApiCall(
    () => API.getRoutes(filters),
    [JSON.stringify(filters)]
  )
}

export function useDashboardStats() {
  return useApiCall(() => API.getDashboardStats(), [])
}

// Mutation hooks
export function useOrderMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrder = async (orderData: Partial<Order>) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await API.createOrder(orderData)
      if (result.error) {
        setError(result.error)
        return null
      }
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await API.updateOrder(id, updates)
      if (result.error) {
        setError(result.error)
        return null
      }
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createOrder, updateOrder, loading, error }
}

export function useDriverMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateDriverStatus = async (id: string, status: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await API.updateDriverStatus(id, status)
      if (result.error) {
        setError(result.error)
        return false
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update driver status')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { updateDriverStatus, loading, error }
}

export function useRouteMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assignDriverToRoute = async (routeId: string, driverId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await API.assignDriverToRoute(routeId, driverId)
      if (result.error) {
        setError(result.error)
        return false
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign driver to route')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { assignDriverToRoute, loading, error }
}
