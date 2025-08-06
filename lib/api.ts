import { supabase } from './supabase'

// Types
export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  delivery_address: string
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
  updated_at: string
  assigned_driver_id?: string
  route_id?: string
  coordinates?: [number, number]
  assigned_driver?: Driver
}

export interface Driver {
  id: string
  user_id?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: string
  status?: 'active' | 'inactive' | 'suspended'
  availability_status?: 'available' | 'assigned' | 'offline' | 'busy'
  created_at: string
  updated_at: string
}

export interface Route {
  id: string
  route_number: string
  route_name: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  total_stops: number
  total_distance: number
  estimated_duration: number
  driver_id?: string
  created_by: string
  created_at: string
  updated_at: string
  driver?: Driver
  route_stops?: RouteStop[]
}

export interface RouteStop {
  id: string
  route_id: string
  order_id: string
  stop_number: number
  sequence_order: number
  address: string
  latitude?: number
  longitude?: number
  status: 'pending' | 'completed' | 'failed'
  estimated_time: number
  distance_from_previous: number
}

// API Functions
export class API {
  // Orders
  static async getOrders(filters?: {
    status?: string
    priority?: string
    driver_id?: string
    route_id?: string
    limit?: number
    offset?: number
  }): Promise<{ data: Order[]; error: string | null }> {
    try {
      // First try to get orders with driver information
      let query = supabase
        .from('orders')
        .select(`
          *,
          assigned_driver:user_profiles(
            id,
            first_name,
            last_name,
            email,
            role
          )
        `)
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority)
      }
      if (filters?.driver_id) {
        query = query.eq('assigned_driver_id', filters.driver_id)
      }
      if (filters?.route_id) {
        query = query.eq('route_id', filters.route_id)
      }
      if (filters?.limit) {
        const offset = filters.offset || 0
        query = query.range(offset, offset + filters.limit - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching orders with joins:', error)
        // Fallback to simple query without joins
        return this.getOrdersSimple(filters)
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('API Error - getOrders:', error)
      // Fallback to simple query
      return this.getOrdersSimple(filters)
    }
  }

  // Simple fallback method for orders without joins
  static async getOrdersSimple(filters?: {
    status?: string
    priority?: string
    driver_id?: string
    route_id?: string
    limit?: number
    offset?: number
  }): Promise<{ data: Order[]; error: string | null }> {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority)
      }
      if (filters?.driver_id) {
        query = query.eq('assigned_driver_id', filters.driver_id)
      }
      if (filters?.route_id) {
        query = query.eq('route_id', filters.route_id)
      }
      if (filters?.limit) {
        const offset = filters.offset || 0
        query = query.range(offset, offset + filters.limit - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching orders (simple):', error)
        return { data: [], error: error.message }
      }

      // If we have orders with assigned drivers, fetch driver info separately
      const ordersWithDrivers = await this.enrichOrdersWithDriverInfo(data || [])

      return { data: ordersWithDrivers, error: null }
    } catch (error) {
      console.error('API Error - getOrdersSimple:', error)
      return { data: [], error: 'Failed to fetch orders' }
    }
  }

  // Helper method to enrich orders with driver information
  static async enrichOrdersWithDriverInfo(orders: Order[]): Promise<Order[]> {
    if (!orders.length) return orders

    const driverIds = orders
      .map(order => order.assigned_driver_id)
      .filter(Boolean) as string[]

    if (!driverIds.length) return orders

    try {
      const { data: drivers } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, role')
        .in('id', driverIds)

      const driverMap = new Map(drivers?.map(driver => [driver.id, driver]) || [])

      return orders.map(order => ({
        ...order,
        assigned_driver: order.assigned_driver_id ? driverMap.get(order.assigned_driver_id) : undefined
      }))
    } catch (error) {
      console.error('Error enriching orders with driver info:', error)
      return orders
    }
  }

  static async createOrder(orderData: Partial<Order>): Promise<{ data: Order | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          ...orderData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating order:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('API Error - createOrder:', error)
      return { data: null, error: 'Failed to create order' }
    }
  }

  static async updateOrder(id: string, updates: Partial<Order>): Promise<{ data: Order | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating order:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('API Error - updateOrder:', error)
      return { data: null, error: 'Failed to update order' }
    }
  }

  // Drivers
  static async getDrivers(filters?: {
    status?: string
    availability_status?: string
  }): Promise<{ data: Driver[]; error: string | null }> {
    try {
      let query = supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'driver')
        .order('first_name')

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.availability_status && filters.availability_status !== 'all') {
        query = query.eq('availability_status', filters.availability_status)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching drivers:', error)
        return { data: [], error: error.message }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('API Error - getDrivers:', error)
      return { data: [], error: 'Failed to fetch drivers' }
    }
  }

  static async updateDriverStatus(id: string, status: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          availability_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('Error updating driver status:', error)
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      console.error('API Error - updateDriverStatus:', error)
      return { error: 'Failed to update driver status' }
    }
  }

  // Routes
  static async getRoutes(filters?: {
    status?: string
    driver_id?: string
  }): Promise<{ data: Route[]; error: string | null }> {
    try {
      let query = supabase
        .from('routes')
        .select(`
          *,
          driver:user_profiles(
            id,
            first_name,
            last_name,
            email,
            role
          ),
          route_stops(
            id,
            stop_number,
            sequence_order,
            address,
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

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.driver_id) {
        query = query.eq('driver_id', filters.driver_id)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching routes:', error)
        // Fallback to simple routes query
        return this.getRoutesSimple(filters)
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('API Error - getRoutes:', error)
      return this.getRoutesSimple(filters)
    }
  }

  static async getRoutesSimple(filters?: {
    status?: string
    driver_id?: string
  }): Promise<{ data: Route[]; error: string | null }> {
    try {
      let query = supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.driver_id) {
        query = query.eq('driver_id', filters.driver_id)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching routes (simple):', error)
        return { data: [], error: error.message }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('API Error - getRoutesSimple:', error)
      return { data: [], error: 'Failed to fetch routes' }
    }
  }

  static async assignDriverToRoute(routeId: string, driverId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('routes')
        .update({
          driver_id: driverId,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', routeId)

      if (error) {
        console.error('Error assigning driver to route:', error)
        return { error: error.message }
      }

      // Update orders in the route
      await supabase
        .from('orders')
        .update({
          assigned_driver_id: driverId,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('route_id', routeId)

      return { error: null }
    } catch (error) {
      console.error('API Error - assignDriverToRoute:', error)
      return { error: 'Failed to assign driver to route' }
    }
  }

  // Dashboard Stats
  static async getDashboardStats(): Promise<{
    data: {
      totalOrders: number
      pendingOrders: number
      inTransitOrders: number
      completedOrders: number
      activeDrivers: number
      totalDrivers: number
      successRate: number
      deliveredToday: number
    } | null
    error: string | null
  }> {
    try {
      // Get orders stats
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, created_at')

      if (ordersError) {
        return { data: null, error: ordersError.message }
      }

      // Get drivers stats
      const { data: drivers, error: driversError } = await supabase
        .from('user_profiles')
        .select('id, availability_status')
        .eq('role', 'driver')

      if (driversError) {
        return { data: null, error: driversError.message }
      }

      const totalOrders = orders?.length || 0
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0
      const inTransitOrders = orders?.filter(o => o.status === 'in_transit').length || 0
      const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0
      
      const totalDrivers = drivers?.length || 0
      const activeDrivers = drivers?.filter(d => d.availability_status === 'available').length || 0
      
      const today = new Date().toISOString().split('T')[0]
      const deliveredToday = orders?.filter(o => 
        o.status === 'delivered' && 
        o.created_at.startsWith(today)
      ).length || 0
      
      const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

      return {
        data: {
          totalOrders,
          pendingOrders,
          inTransitOrders,
          completedOrders,
          activeDrivers,
          totalDrivers,
          successRate,
          deliveredToday
        },
        error: null
      }
    } catch (error) {
      console.error('API Error - getDashboardStats:', error)
      return { data: null, error: 'Failed to fetch dashboard stats' }
    }
  }
}
