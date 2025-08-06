import { supabase } from '@/lib/supabase'
import type { Order, Route, RouteStop } from '@/lib/supabase'

interface OptimizationOptions {
  maxStopsPerRoute?: number
  maxRouteDistance?: number
  prioritizeUrgent?: boolean
}

interface RouteOptimizationResult {
  routes: Array<{
    orders: Order[]
    totalDistance: number
    estimatedDuration: number
  }>
  unassignedOrders: Order[]
}

export class RouteManager {
  static async optimizeRoutes(
    orders: Order[],
    options: OptimizationOptions = {}
  ): Promise<RouteOptimizationResult> {
    const {
      maxStopsPerRoute = 10,
      maxRouteDistance = 100,
      prioritizeUrgent = true
    } = options

    try {
      // Sort orders by priority if enabled
      const sortedOrders = prioritizeUrgent
        ? [...orders].sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
            return priorityOrder[a.priority] - priorityOrder[b.priority]
          })
        : [...orders]

      const routes: Array<{
        orders: Order[]
        totalDistance: number
        estimatedDuration: number
      }> = []

      const unassignedOrders: Order[] = []
      const processedOrders = new Set<string>()

      for (const order of sortedOrders) {
        if (processedOrders.has(order.id)) continue

        // Start a new route with this order
        const routeOrders = [order]
        processedOrders.add(order.id)

        // Find nearby orders to add to this route
        for (const candidateOrder of sortedOrders) {
          if (
            processedOrders.has(candidateOrder.id) ||
            routeOrders.length >= maxStopsPerRoute
          ) {
            continue
          }

          // Simple distance check (in a real implementation, you'd use proper geocoding)
          const distance = this.calculateDistance(order, candidateOrder)
          if (distance <= 10) { // 10km radius
            routeOrders.push(candidateOrder)
            processedOrders.add(candidateOrder.id)
          }
        }

        // Calculate route metrics
        const totalDistance = this.calculateRouteDistance(routeOrders)
        const estimatedDuration = this.estimateRouteDuration(routeOrders)

        if (totalDistance <= maxRouteDistance) {
          routes.push({
            orders: routeOrders,
            totalDistance,
            estimatedDuration
          })
        } else {
          // If route is too long, add orders to unassigned
          routeOrders.forEach(o => {
            if (o.id !== order.id) {
              unassignedOrders.push(o)
              processedOrders.delete(o.id)
            }
          })
          
          routes.push({
            orders: [order],
            totalDistance: 0,
            estimatedDuration: 30
          })
        }
      }

      return { routes, unassignedOrders }
    } catch (error) {
      console.error('Route optimization failed:', error)
      return { routes: [], unassignedOrders: orders }
    }
  }

  static async createRoute(
    routeName: string,
    orders: Order[],
    driverId?: string,
    createdBy: string = 'system'
  ): Promise<{ success: boolean; routeId?: string; error?: string }> {
    try {
      // Generate route number
      const routeNumber = await this.generateRouteNumber()

      // Create the route
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert([{
          route_number: routeNumber,
          route_name: routeName,
          driver_id: driverId,
          status: 'planned',
          total_stops: orders.length,
          total_distance: this.calculateRouteDistance(orders),
          estimated_duration: this.estimateRouteDuration(orders),
          created_by: createdBy
        }])
        .select()
        .single()

      if (routeError) throw routeError

      // Create route stops
      const routeStops = orders.map((order, index) => ({
        route_id: route.id,
        order_id: order.id,
        sequence_order: index + 1,
        status: 'pending' as const
      }))

      const { error: stopsError } = await supabase
        .from('route_stops')
        .insert(routeStops)

      if (stopsError) throw stopsError

      // Update orders with route assignment
      const { error: ordersError } = await supabase
        .from('orders')
        .update({ route_id: route.id })
        .in('id', orders.map(o => o.id))

      if (ordersError) throw ordersError

      return { success: true, routeId: route.id }
    } catch (error) {
      console.error('Failed to create route:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  static async assignDriverToRoute(
    routeId: string,
    driverId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('routes')
        .update({ driver_id: driverId })
        .eq('id', routeId)

      if (error) throw error

      // Update driver availability
      await supabase
        .from('user_profiles')
        .update({ availability_status: 'assigned' })
        .eq('id', driverId)

      return { success: true }
    } catch (error) {
      console.error('Failed to assign driver to route:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  static async updateRouteStatus(
    routeId: string,
    status: Route['status']
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updates: Partial<Route> = { status }

      if (status === 'in_progress') {
        updates.started_at = new Date().toISOString()
      } else if (status === 'completed') {
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('routes')
        .update(updates)
        .eq('id', routeId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Failed to update route status:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  static async getRouteDetails(routeId: string): Promise<Route | null> {
    try {
      const { data, error } = await supabase
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
              delivery_address,
              coordinates
            )
          )
        `)
        .eq('id', routeId)
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Failed to get route details:', error)
      return null
    }
  }

  private static calculateDistance(order1: Order, order2: Order): number {
    // Simple Euclidean distance calculation
    // In a real implementation, you'd use proper geocoding services
    if (!order1.coordinates || !order2.coordinates) return 0

    const [lat1, lon1] = order1.coordinates
    const [lat2, lon2] = order2.coordinates

    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private static calculateRouteDistance(orders: Order[]): number {
    if (orders.length < 2) return 0

    let totalDistance = 0
    for (let i = 0; i < orders.length - 1; i++) {
      totalDistance += this.calculateDistance(orders[i], orders[i + 1])
    }
    return totalDistance
  }

  private static estimateRouteDuration(orders: Order[]): number {
    // Estimate 15 minutes per stop + travel time
    const stopTime = orders.length * 15
    const travelTime = this.calculateRouteDistance(orders) * 2 // 2 minutes per km
    return stopTime + travelTime
  }

  private static async generateRouteNumber(): Promise<string> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    const { data, error } = await supabase
      .from('routes')
      .select('route_number')
      .like('route_number', `R${today}%`)
      .order('route_number', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error generating route number:', error)
      return `R${today}001`
    }

    if (!data || data.length === 0) {
      return `R${today}001`
    }

    const lastNumber = parseInt(data[0].route_number.slice(-3))
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0')
    return `R${today}${nextNumber}`
  }
}

// Export the instance for backward compatibility
export const routeManager = RouteManager
