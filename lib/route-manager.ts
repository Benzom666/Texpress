import { supabaseClient } from './supabase-client'

export interface RouteStop {
  id: string
  route_id: string
  order_id: string
  sequence_order: number
  estimated_arrival_time?: string
  actual_arrival_time?: string
  status: 'pending' | 'completed' | 'skipped'
  notes?: string
  coordinates?: [number, number]
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
  stops?: RouteStop[]
}

export interface CreateRouteData {
  route_name: string
  driver_id?: string
  order_ids: string[]
  created_by: string
}

export interface OptimizeRouteOptions {
  depot_coordinates?: [number, number]
  vehicle_capacity?: number
  max_duration?: number
  optimization_type?: 'distance' | 'time' | 'balanced'
}

export class RouteManager {
  private supabase = supabaseClient

  /**
   * Create a new route with orders
   */
  async createRoute(data: CreateRouteData): Promise<Route | null> {
    try {
      // Generate route number
      const routeNumber = await this.generateRouteNumber()
      
      // Create the route
      const { data: route, error: routeError } = await this.supabase
        .from('routes')
        .insert([{
          route_number: routeNumber,
          route_name: data.route_name,
          driver_id: data.driver_id,
          status: 'planned',
          total_stops: data.order_ids.length,
          created_by: data.created_by
        }])
        .select()
        .single()

      if (routeError) throw routeError

      // Create route stops
      if (data.order_ids.length > 0) {
        const stops = data.order_ids.map((orderId, index) => ({
          route_id: route.id,
          order_id: orderId,
          sequence_order: index + 1,
          status: 'pending' as const
        }))

        const { error: stopsError } = await this.supabase
          .from('route_stops')
          .insert(stops)

        if (stopsError) throw stopsError

        // Update orders with route assignment
        const { error: ordersError } = await this.supabase
          .from('orders')
          .update({ 
            route_id: route.id,
            status: 'assigned'
          })
          .in('id', data.order_ids)

        if (ordersError) throw ordersError
      }

      return route
    } catch (error) {
      console.error('Error creating route:', error)
      return null
    }
  }

  /**
   * Get route by ID with stops
   */
  async getRoute(routeId: string): Promise<Route | null> {
    try {
      const { data: route, error: routeError } = await this.supabase
        .from('routes')
        .select(`
          *,
          route_stops (
            *,
            orders (
              id,
              order_number,
              customer_name,
              delivery_address,
              latitude,
              longitude,
              status
            )
          )
        `)
        .eq('id', routeId)
        .single()

      if (routeError) throw routeError

      return route
    } catch (error) {
      console.error('Error fetching route:', error)
      return null
    }
  }

  /**
   * Get all routes with optional filters
   */
  async getRoutes(filters?: {
    status?: Route['status']
    driver_id?: string
    date_from?: string
    date_to?: string
  }): Promise<Route[]> {
    try {
      let query = this.supabase
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

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from)
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      const { data, error } = await query

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching routes:', error)
      return []
    }
  }

  /**
   * Update route
   */
  async updateRoute(routeId: string, updates: Partial<Route>): Promise<Route | null> {
    try {
      const { data, error } = await this.supabase
        .from('routes')
        .update(updates)
        .eq('id', routeId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error updating route:', error)
      return null
    }
  }

  /**
   * Delete route
   */
  async deleteRoute(routeId: string): Promise<boolean> {
    try {
      // First, unassign orders from the route
      await this.supabase
        .from('orders')
        .update({ 
          route_id: null,
          status: 'pending'
        })
        .eq('route_id', routeId)

      // Delete route stops
      await this.supabase
        .from('route_stops')
        .delete()
        .eq('route_id', routeId)

      // Delete the route
      const { error } = await this.supabase
        .from('routes')
        .delete()
        .eq('id', routeId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error deleting route:', error)
      return false
    }
  }

  /**
   * Assign driver to route
   */
  async assignDriver(routeId: string, driverId: string): Promise<Route | null> {
    try {
      const { data, error } = await this.supabase
        .from('routes')
        .update({ driver_id: driverId })
        .eq('id', routeId)
        .select()
        .single()

      if (error) throw error

      // Update driver availability
      await this.supabase
        .from('user_profiles')
        .update({ availability_status: 'assigned' })
        .eq('id', driverId)

      return data
    } catch (error) {
      console.error('Error assigning driver:', error)
      return null
    }
  }

  /**
   * Start route
   */
  async startRoute(routeId: string): Promise<Route | null> {
    try {
      const { data, error } = await this.supabase
        .from('routes')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', routeId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error starting route:', error)
      return null
    }
  }

  /**
   * Complete route
   */
  async completeRoute(routeId: string): Promise<Route | null> {
    try {
      const now = new Date().toISOString()
      
      const { data, error } = await this.supabase
        .from('routes')
        .update({ 
          status: 'completed',
          completed_at: now
        })
        .eq('id', routeId)
        .select()
        .single()

      if (error) throw error

      // Update driver availability
      if (data.driver_id) {
        await this.supabase
          .from('user_profiles')
          .update({ availability_status: 'available' })
          .eq('id', data.driver_id)
      }

      return data
    } catch (error) {
      console.error('Error completing route:', error)
      return null
    }
  }

  /**
   * Optimize route order using simple distance-based algorithm
   */
  async optimizeRoute(routeId: string, options?: OptimizeRouteOptions): Promise<boolean> {
    try {
      // Get route with stops and order coordinates
      const route = await this.getRoute(routeId)
      if (!route || !route.stops) return false

      // Simple optimization: sort by distance from depot or first stop
      const depot = options?.depot_coordinates || [0, 0]
      
      const optimizedStops = route.stops
        .map(stop => ({
          ...stop,
          distance: this.calculateDistance(
            depot,
            stop.coordinates || [0, 0]
          )
        }))
        .sort((a, b) => a.distance - b.distance)
        .map((stop, index) => ({
          id: stop.id,
          sequence_order: index + 1
        }))

      // Update stop sequences
      for (const stop of optimizedStops) {
        await this.supabase
          .from('route_stops')
          .update({ sequence_order: stop.sequence_order })
          .eq('id', stop.id)
      }

      return true
    } catch (error) {
      console.error('Error optimizing route:', error)
      return false
    }
  }

  /**
   * Generate unique route number
   */
  private async generateRouteNumber(): Promise<string> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    // Get count of routes created today
    const { count } = await this.supabase
      .from('routes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0])
      .lt('created_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    const sequence = String((count || 0) + 1).padStart(3, '0')
    return `RT${today}${sequence}`
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lon1, lat1] = coord1
    const [lon2, lat2] = coord2
    
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  // Static methods for backward compatibility
  static async getCurrentRoute(driverId: string): Promise<any> {
    const manager = new RouteManager()
    const routes = await manager.getRoutes({ driver_id: driverId, status: 'in_progress' })
    return routes[0] || null
  }

  static async createOptimizedRoute(driverId: string, orders: any[]): Promise<any> {
    const manager = new RouteManager()
    const routeData: CreateRouteData = {
      route_name: `Optimized Route ${new Date().toLocaleDateString()}`,
      driver_id: driverId,
      order_ids: orders.map(o => o.id),
      created_by: driverId
    }
    return await manager.createRoute(routeData)
  }

  static async completeDelivery(routeId: string, orderId: string, actualTime?: number, actualDistance?: number): Promise<any> {
    const manager = new RouteManager()
    // Update the specific stop as completed
    await manager.supabase
      .from('route_stops')
      .update({ 
        status: 'completed',
        actual_arrival_time: new Date().toISOString()
      })
      .eq('route_id', routeId)
      .eq('order_id', orderId)
    
    return await manager.getRoute(routeId)
  }

  static async addDeliveryToRoute(routeId: string, order: any): Promise<any> {
    const manager = new RouteManager()
    // Add new stop to route
    const { data: stops } = await manager.supabase
      .from('route_stops')
      .select('sequence_order')
      .eq('route_id', routeId)
      .order('sequence_order', { ascending: false })
      .limit(1)

    const nextSequence = (stops?.[0]?.sequence_order || 0) + 1

    await manager.supabase
      .from('route_stops')
      .insert({
        route_id: routeId,
        order_id: order.id,
        sequence_order: nextSequence,
        status: 'pending'
      })

    return await manager.getRoute(routeId)
  }

  static async cancelDelivery(routeId: string, orderId: string, reason: string): Promise<any> {
    const manager = new RouteManager()
    await manager.supabase
      .from('route_stops')
      .update({ 
        status: 'skipped',
        notes: reason
      })
      .eq('route_id', routeId)
      .eq('order_id', orderId)
    
    return await manager.getRoute(routeId)
  }

  static async recalculateRoute(routeId: string, pendingOrders: any[]): Promise<any> {
    const manager = new RouteManager()
    await manager.optimizeRoute(routeId)
    return await manager.getRoute(routeId)
  }

  static async endShift(routeId: string): Promise<void> {
    const manager = new RouteManager()
    await manager.updateRoute(routeId, { status: 'completed', completed_at: new Date().toISOString() })
  }

  static async safeEndRoute(routeId: string): Promise<void> {
    try {
      await this.endShift(routeId)
    } catch (error) {
      console.error('Error ending route:', error)
    }
  }
}

// Export singleton instance
export const routeManager = new RouteManager()

// Default export
export default RouteManager
