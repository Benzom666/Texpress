interface ApiResponse<T> {
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}/api${endpoint}`
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data }
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error)
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Orders API
  async getOrders(params: {
    page?: number
    limit?: number
    status?: string
    priority?: string
    search?: string
  } = {}) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString())
      }
    })

    const queryString = searchParams.toString()
    const endpoint = `/orders${queryString ? `?${queryString}` : ''}`
    
    return this.request<{
      orders: any[]
      pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
      }
    }>(endpoint)
  }

  async createOrder(orderData: any) {
    return this.request<{ order: any }>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
  }

  async getOrder(id: string) {
    return this.request<{ order: any }>(`/orders/${id}`)
  }

  async updateOrder(id: string, updates: any) {
    return this.request<{ order: any }>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteOrder(id: string) {
    return this.request<{ success: boolean }>(`/orders/${id}`, {
      method: 'DELETE',
    })
  }

  // Drivers API
  async getDrivers(params: { available?: boolean } = {}) {
    const searchParams = new URLSearchParams()
    if (params.available !== undefined) {
      searchParams.append('available', params.available.toString())
    }

    const queryString = searchParams.toString()
    const endpoint = `/drivers${queryString ? `?${queryString}` : ''}`
    
    return this.request<{ drivers: any[] }>(endpoint)
  }

  async createDriver(driverData: any) {
    return this.request<{ driver: any }>('/drivers', {
      method: 'POST',
      body: JSON.stringify(driverData),
    })
  }

  async getDriver(id: string) {
    return this.request<{ driver: any }>(`/drivers/${id}`)
  }

  async updateDriver(id: string, updates: any) {
    return this.request<{ driver: any }>(`/drivers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  // Route Optimization API
  async optimizeSelectedOrders(params: {
    orderIds: string[]
    driverId?: string
    optimizationType?: 'distance' | 'time' | 'priority'
  }) {
    return this.request<{
      success: boolean
      routeId?: string
      stops: any[]
      totalDistance: number
      totalTime: number
      optimizationType: string
    }>('/optimize-selected-orders', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Routes API
  async getRoutes() {
    return this.request<{ routes: any[] }>('/routes')
  }

  async createRoute(routeData: any) {
    return this.request<{ route: any }>('/routes', {
      method: 'POST',
      body: JSON.stringify(routeData),
    })
  }

  async getRoute(id: string) {
    return this.request<{ route: any }>(`/routes/${id}`)
  }

  async updateRoute(id: string, updates: any) {
    return this.request<{ route: any }>(`/routes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async deleteRoute(id: string) {
    return this.request<{ success: boolean }>(`/routes/${id}`, {
      method: 'DELETE',
    })
  }
}

export const apiClient = new ApiClient()
export default apiClient
