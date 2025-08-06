import { supabase } from '@/lib/supabase'

export interface RouteData {
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

export class RouteManager {
  static async createRoute(routeData: Partial<RouteData>): Promise<RouteData | null> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .insert([routeData])
        .select()
        .single()

      if (error) {
        console.error('Error creating route:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error creating route:', error)
      return null
    }
  }

  static async getRoute(routeId: string): Promise<RouteData | null> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single()

      if (error) {
        console.error('Error fetching route:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching route:', error)
      return null
    }
  }

  static async updateRoute(routeId: string, updates: Partial<RouteData>): Promise<RouteData | null> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .update(updates)
        .eq('id', routeId)
        .select()
        .single()

      if (error) {
        console.error('Error updating route:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error updating route:', error)
      return null
    }
  }

  static async deleteRoute(routeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', routeId)

      if (error) {
        console.error('Error deleting route:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting route:', error)
      return false
    }
  }

  static async getRoutesByDriver(driverId: string): Promise<RouteData[]> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching driver routes:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching driver routes:', error)
      return []
    }
  }

  static async getAllRoutes(): Promise<RouteData[]> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching all routes:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching all routes:', error)
      return []
    }
  }

  static async assignDriver(routeId: string, driverId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('routes')
        .update({ driver_id: driverId })
        .eq('id', routeId)

      if (error) {
        console.error('Error assigning driver to route:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error assigning driver to route:', error)
      return false
    }
  }

  static async updateRouteStatus(routeId: string, status: RouteData['status']): Promise<boolean> {
    try {
      const updates: Partial<RouteData> = { status }
      
      if (status === 'in_progress') {
        updates.started_at = new Date().toISOString()
      } else if (status === 'completed') {
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('routes')
        .update(updates)
        .eq('id', routeId)

      if (error) {
        console.error('Error updating route status:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating route status:', error)
      return false
    }
  }

  static async getRouteStops(routeId: string): Promise<RouteStop[]> {
    try {
      const { data, error } = await supabase
        .from('route_stops')
        .select('*')
        .eq('route_id', routeId)
        .order('sequence_order', { ascending: true })

      if (error) {
        console.error('Error fetching route stops:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching route stops:', error)
      return []
    }
  }

  static async addRouteStop(routeStop: Partial<RouteStop>): Promise<RouteStop | null> {
    try {
      const { data, error } = await supabase
        .from('route_stops')
        .insert([routeStop])
        .select()
        .single()

      if (error) {
        console.error('Error adding route stop:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error adding route stop:', error)
      return null
    }
  }

  static async updateRouteStop(stopId: string, updates: Partial<RouteStop>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('route_stops')
        .update(updates)
        .eq('id', stopId)

      if (error) {
        console.error('Error updating route stop:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating route stop:', error)
      return false
    }
  }
}

// Export the class as default and named export for compatibility
export const routeManager = RouteManager
export default RouteManager
