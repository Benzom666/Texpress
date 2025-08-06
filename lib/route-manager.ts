import { supabase } from "@/lib/supabase"

interface OptimizedStop {
  stopNumber: number
  stopLabel: string
  orderId: string
  coordinates: [number, number]
  estimatedTime: number
  distance: number
}

interface CreateRouteParams {
  routeName: string
  stops: OptimizedStop[]
  totalDistance: number
  totalTime: number
  createdBy: string
  driverId?: string
}

interface Route {
  id: string
  route_number: string
  route_name: string
  status: string
  total_distance: number
  estimated_duration: number
  driver_id?: string
  created_by: string
  created_at: string
  updated_at: string
}

interface RouteStop {
  id: string
  route_id: string
  order_id: string
  stop_number: number
  coordinates: [number, number]
  estimated_time: number
  distance_from_previous: number
  status: string
  actual_arrival_time?: string
  notes?: string
}

interface TableSchema {
  [columnName: string]: {
    data_type: string
    is_nullable: string
    column_default?: string
  }
}

export class RouteManager {
  private static schemaCache: { [tableName: string]: TableSchema } = {}

  /**
   * Get the actual schema of a table from the database
   */
  static async getTableSchema(tableName: string): Promise<TableSchema> {
    if (this.schemaCache[tableName]) {
      return this.schemaCache[tableName]
    }

    try {
      const { data, error } = await supabase.rpc("get_table_schema", { table_name: tableName })

      if (error) {
        console.warn(`Could not get schema for ${tableName}, using fallback method:`, error)
        return await this.getTableSchemaFallback(tableName)
      }

      const schema: TableSchema = {}
      if (data && Array.isArray(data)) {
        data.forEach((col: any) => {
          schema[col.column_name] = {
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            column_default: col.column_default,
          }
        })
      }

      this.schemaCache[tableName] = schema
      return schema
    } catch (error) {
      console.warn(`Error getting schema for ${tableName}:`, error)
      return await this.getTableSchemaFallback(tableName)
    }
  }

  /**
   * Fallback method to get table schema by attempting a select
   */
  static async getTableSchemaFallback(tableName: string): Promise<TableSchema> {
    try {
      // Try to select from the table with limit 0 to get column info
      const { data, error } = await supabase.from(tableName).select("*").limit(0)

      if (error) {
        console.error(`Fallback schema check failed for ${tableName}:`, error)
        return {}
      }

      // Return known schema for route_stops
      if (tableName === "route_stops") {
        return {
          id: { data_type: "uuid", is_nullable: "NO" },
          route_id: { data_type: "uuid", is_nullable: "NO" },
          order_id: { data_type: "uuid", is_nullable: "NO" },
          stop_number: { data_type: "integer", is_nullable: "NO" },
          sequence_order: { data_type: "integer", is_nullable: "NO" },
          stop_label: { data_type: "text", is_nullable: "YES" },
          address: { data_type: "text", is_nullable: "YES" },
          latitude: { data_type: "numeric", is_nullable: "YES" },
          longitude: { data_type: "numeric", is_nullable: "YES" },
          estimated_time: { data_type: "integer", is_nullable: "YES" },
          distance_from_previous: { data_type: "numeric", is_nullable: "YES" },
          status: { data_type: "text", is_nullable: "YES" },
          actual_arrival_time: { data_type: "timestamp with time zone", is_nullable: "YES" },
          actual_departure_time: { data_type: "timestamp with time zone", is_nullable: "YES" },
          notes: { data_type: "text", is_nullable: "YES" },
          created_at: { data_type: "timestamp with time zone", is_nullable: "YES" },
          updated_at: { data_type: "timestamp with time zone", is_nullable: "YES" },
        }
      }

      return {}
    } catch (error) {
      console.error(`Fallback schema check error for ${tableName}:`, error)
      return {}
    }
  }

  /**
   * Comprehensive database structure verification
   */
  static async verifyDatabaseStructure(): Promise<{ valid: boolean; error?: string }> {
    try {
      console.log("Verifying database structure...")

      // Check routes table
      const { data: routesTest, error: routesError } = await supabase.from("routes").select("id, route_name").limit(1)

      if (routesError) {
        console.error("Routes table verification failed:", routesError)
        return {
          valid: false,
          error: `Routes table is not accessible: ${routesError.message}. Please run migration scripts.`,
        }
      }

      // Check route_stops table
      const { data: stopsTest, error: stopsError } = await supabase
        .from("route_stops")
        .select("id, route_id, order_id")
        .limit(1)

      if (stopsError) {
        console.error("Route_stops table verification failed:", stopsError)
        return {
          valid: false,
          error: `Route_stops table is not accessible: ${stopsError.message}. Please run migration scripts.`,
        }
      }

      // Check orders table
      const { data: ordersTest, error: ordersError } = await supabase.from("orders").select("id").limit(1)

      if (ordersError) {
        console.error("Orders table verification failed:", ordersError)
        return {
          valid: false,
          error: `Orders table is not accessible: ${ordersError.message}`,
        }
      }

      console.log("Database structure verification passed")
      return { valid: true }
    } catch (error) {
      console.error("Database structure verification failed:", error)
      return {
        valid: false,
        error: `Database verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }
    }
  }

  /**
   * Get order details including address for route stops
   */
  static async getOrderDetails(orderIds: string[]): Promise<{ [orderId: string]: any }> {
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, delivery_address, coordinates, priority")
        .in("id", orderIds)

      if (error) {
        console.error("Error fetching order details:", error)
        return {}
      }

      const orderMap: { [orderId: string]: any } = {}
      orders?.forEach((order) => {
        orderMap[order.id] = order
      })

      return orderMap
    } catch (error) {
      console.error("Error in getOrderDetails:", error)
      return {}
    }
  }

  /**
   * Validate that all order IDs exist in the database
   */
  static async validateOrderIds(orderIds: string[]): Promise<string[]> {
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id")
        .in("id", orderIds)

      if (error) {
        console.error("Error validating order IDs:", error)
        return []
      }

      const validIds = orders?.map((order) => order.id) || []
      const invalidIds = orderIds.filter((id) => !validIds.includes(id))

      if (invalidIds.length > 0) {
        console.warn("Invalid order IDs found:", invalidIds)
      }

      return validIds
    } catch (error) {
      console.error("Error in validateOrderIds:", error)
      return []
    }
  }

  /**
   * Create a route stop object with proper data validation and null handling
   */
  static createRouteStopData(stop: OptimizedStop, routeId: string, orderDetails: { [orderId: string]: any }): any {
    const order = orderDetails[stop.orderId]

    // Ensure we have a valid address, use fallback if needed
    let address = order?.delivery_address
    if (!address || address.trim() === "") {
      address = `Stop ${stop.stopNumber} - Address not available`
      console.warn(`No address found for order ${stop.orderId}, using fallback: ${address}`)
    }

    // Ensure we have valid coordinates
    let latitude = null
    let longitude = null

    if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length >= 2) {
      latitude = Number.parseFloat(stop.coordinates[0].toString())
      longitude = Number.parseFloat(stop.coordinates[1].toString())

      // Validate coordinates are reasonable
      if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        console.warn(`Invalid coordinates for stop ${stop.stopNumber}:`, stop.coordinates)
        latitude = null
        longitude = null
      }
    }

    // If no coordinates from stop, try to get from order
    if (!latitude || !longitude) {
      if (order?.coordinates) {
        try {
          // Handle PostgreSQL POINT format or array format
          if (typeof order.coordinates === "string") {
            const coords = order.coordinates.replace(/[()]/g, "").split(",")
            if (coords.length >= 2) {
              latitude = Number.parseFloat(coords[0])
              longitude = Number.parseFloat(coords[1])
            }
          } else if (Array.isArray(order.coordinates) && order.coordinates.length >= 2) {
            latitude = Number.parseFloat(order.coordinates[0])
            longitude = Number.parseFloat(order.coordinates[1])
          }
        } catch (error) {
          console.warn(`Error parsing order coordinates for ${stop.orderId}:`, error)
        }
      }
    }

    const stopData = {
      route_id: routeId,
      order_id: stop.orderId,
      stop_number: stop.stopNumber,
      sequence_order: stop.stopNumber,
      stop_label: stop.stopLabel || `Stop ${stop.stopNumber}`,
      address: address,
      latitude: latitude,
      longitude: longitude,
      estimated_time: Math.max(1, Math.round(stop.estimatedTime)) || 15,
      distance_from_previous: Math.max(0, Math.round(stop.distance * 100) / 100) || 0,
      status: "pending",
    }

    console.log(`Created stop data for ${stop.stopNumber}:`, {
      orderId: stopData.order_id,
      address: stopData.address,
      hasCoordinates: !!(latitude && longitude),
      estimatedTime: stopData.estimated_time,
    })

    return stopData
  }

  /**
   * Generate a unique route number - Fixed to ensure TEXT format
   */
  static async generateRouteNumber(): Promise<string> {
    try {
      console.log("Generating route number...")

      // Try to use the database function first
      const { data, error } = await supabase.rpc("generate_route_number")

      if (!error && data && typeof data === "string") {
        console.log("Generated route number via database function:", data)
        return data
      }

      console.warn("Database function failed or returned invalid data, using manual generation:", error)

      // Fallback to manual generation
      const date = new Date()
      const dateStr = date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, "0") +
        date.getDate().toString().padStart(2, "0")

      let counter = 1
      let routeNumber: string
      const maxAttempts = 100

      do {
        routeNumber = `RT${dateStr}-${counter.toString().padStart(3, "0")}`

        const { data: existing, error: checkError } = await supabase
          .from("routes")
          .select("id")
          .eq("route_number", routeNumber)
          .maybeSingle()

        if (checkError) {
          console.error("Error checking route number existence:", checkError)
          break
        }

        if (!existing) {
          console.log("Generated unique route number manually:", routeNumber)
          return routeNumber
        }

        counter++
      } while (counter <= maxAttempts)

      // Ultimate fallback using timestamp
      const timestamp = Date.now()
      const fallbackNumber = `RT${dateStr}-${timestamp.toString().slice(-6)}`
      console.log("Using timestamp-based fallback route number:", fallbackNumber)
      return fallbackNumber
    } catch (error) {
      console.error("Error in route number generation:", error)
      const emergency = `RT${Date.now()}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      console.log("Using emergency fallback route number:", emergency)
      return emergency
    }
  }

  static async createRoute(params: CreateRouteParams): Promise<string> {
    const { routeName, stops, totalDistance, totalTime, createdBy, driverId } = params

    try {
      console.log("=== STARTING ROUTE CREATION ===")
      console.log("Route params:", {
        routeName,
        stopsCount: stops.length,
        totalDistance,
        totalTime,
        createdBy,
        driverId,
      })

      // Validate required parameters
      if (!routeName || !createdBy) {
        throw new Error("Route name and created_by are required")
      }

      if (!stops || stops.length === 0) {
        throw new Error("At least one stop is required")
      }

      // Comprehensive database structure verification
      console.log("Verifying database structure...")
      const dbCheck = await this.verifyDatabaseStructure()
      if (!dbCheck.valid) {
        throw new Error(dbCheck.error || "Database structure verification failed")
      }
      console.log("Database structure verification: PASSED")

      // Validate order IDs exist
      console.log("Validating order IDs...")
      const orderIds = stops.map((stop) => stop.orderId)
      const validOrderIds = await this.validateOrderIds(orderIds)

      if (validOrderIds.length === 0) {
        throw new Error("No valid order IDs found")
      }

      if (validOrderIds.length < orderIds.length) {
        console.warn(`Only ${validOrderIds.length} of ${orderIds.length} order IDs are valid`)
      }

      // Filter stops to only include valid orders
      const validStops = stops.filter((stop) => validOrderIds.includes(stop.orderId))
      console.log(`Using ${validStops.length} valid stops`)

      // Get order details for addresses
      console.log("Fetching order details...")
      const orderDetails = await this.getOrderDetails(validOrderIds)
      console.log("Retrieved order details for", Object.keys(orderDetails).length, "orders")

      // Generate a unique route number - ENSURE IT'S A STRING
      const routeNumber = await this.generateRouteNumber()
      console.log("Generated route number (string):", routeNumber, typeof routeNumber)

      // Validate route number is a string
      if (typeof routeNumber !== "string" || routeNumber.trim() === "") {
        throw new Error("Failed to generate valid route number")
      }

      // Create the route record with all required fields
      const routeData = {
        route_number: routeNumber, // Ensure this is a string
        route_name: routeName,
        status: "planned" as const,
        total_distance: Math.round(totalDistance * 100) / 100,
        estimated_duration: Math.round(totalTime),
        created_by: createdBy,
        total_stops: validStops.length,
        driver_id: driverId || null,
      }

      console.log("Creating route with data:", routeData)
      console.log("Route number type check:", typeof routeData.route_number, routeData.route_number)

      // Create the route
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .insert(routeData)
        .select("id, route_number, route_name")
        .single()

      if (routeError) {
        console.error("Route creation failed:", routeError)
        throw new Error(`Failed to create route: ${routeError.message}`)
      }

      if (!route || !route.id) {
        throw new Error("No route data returned from database")
      }

      console.log("Route created successfully:", route)

      // Create route stops with proper error handling and validation
      console.log("Creating route stops...")
      const routeStops = validStops.map((stop) => this.createRouteStopData(stop, route.id, orderDetails))

      console.log("Route stops data prepared:", routeStops.length)
      console.log("Sample route stop:", routeStops[0])

      // Validate all stops have required data
      const invalidStops = routeStops.filter((stop) => !stop.address || stop.address.trim() === "")
      if (invalidStops.length > 0) {
        console.error("Found stops with invalid addresses:", invalidStops)
        throw new Error(`${invalidStops.length} stops have invalid addresses`)
      }

      // Insert route stops with comprehensive error handling
      const { data: createdStops, error: stopsError } = await supabase
        .from("route_stops")
        .insert(routeStops)
        .select("id")

      if (stopsError) {
        console.error("Route stops creation failed:", stopsError)
        console.error("Route stops data that failed:", routeStops)

        // Clean up the route on failure
        try {
          console.log("Cleaning up route due to stops creation failure...")
          await supabase.from("routes").delete().eq("id", route.id)
          console.log("Route cleanup completed")
        } catch (cleanupError) {
          console.error("Error during route cleanup:", cleanupError)
        }

        throw new Error(`Failed to create route stops: ${stopsError.message}`)
      }

      console.log("Route stops created successfully:", createdStops?.length || 0)

      // Update orders to reference this route - FIXED: Ensure route_number is string
      console.log("Updating orders with route information...")
      console.log("Route number being assigned to orders:", route.route_number, typeof route.route_number)

      const orderUpdateData = {
        route_id: route.id,
        route_number: String(route.route_number), // Explicitly convert to string
        assigned_driver_id: driverId || null,
      }

      console.log("Order update data:", orderUpdateData)

      const { error: updateError } = await supabase
        .from("orders")
        .update(orderUpdateData)
        .in("id", validOrderIds)

      if (updateError) {
        console.error("Error updating orders with route_id:", updateError)
        // This is not critical for route creation, so we'll log but not fail
        console.warn("Route created successfully but failed to update orders:", updateError.message)
      } else {
        console.log("Orders updated successfully with route information")
      }

      console.log("=== ROUTE CREATION COMPLETED SUCCESSFULLY ===")
      console.log(`Created route ${route.route_number} with ${validStops.length} stops`)
      return route.id
    } catch (error) {
      console.error("=== ROUTE CREATION FAILED ===")
      console.error("RouteManager.createRoute error:", error)
      throw error
    }
  }

  /**
   * Assign driver to route - Updated to use direct database calls instead of API
   */
  static async assignDriverToRoute(routeId: string, driverId: string): Promise<boolean> {
    try {
      console.log(`🚛 RouteManager: Assigning driver ${driverId} to route ${routeId}`)

      // Verify the driver exists and is available
      const { data: driver, error: driverError } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, role, availability_status')
        .eq('id', driverId)
        .eq('role', 'driver')
        .single()

      if (driverError || !driver) {
        console.error('❌ RouteManager: Driver not found:', driverError)
        return false
      }

      // Check if driver is available (handle missing column gracefully)
      const driverStatus = driver.availability_status || 'available'
      if (driverStatus !== 'available') {
        console.error('❌ RouteManager: Driver is not available for assignment')
        return false
      }

      // Verify the route exists
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('id, route_name, status')
        .eq('id', routeId)
        .single()

      if (routeError || !route) {
        console.error('❌ RouteManager: Route not found:', routeError)
        return false
      }

      // Update the route with the assigned driver
      const { error: updateRouteError } = await supabase
        .from('routes')
        .update({
          driver_id: driverId,
          status: 'planned',
          updated_at: new Date().toISOString()
        })
        .eq('id', routeId)

      if (updateRouteError) {
        console.error('❌ RouteManager: Error updating route:', updateRouteError)
        return false
      }

      // Update all orders in the route to assign the driver
      const { error: updateOrdersError } = await supabase
        .from('orders')
        .update({
          assigned_driver_id: driverId,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('route_id', routeId)

      if (updateOrdersError) {
        console.error('⚠️ RouteManager: Warning - Error updating orders:', updateOrdersError)
        // Don't fail the entire operation, just log the warning
      }

      // Optionally update driver availability status
      try {
        await supabase
          .from('user_profiles')
          .update({
            availability_status: 'assigned',
            updated_at: new Date().toISOString()
          })
          .eq('id', driverId)
      } catch (availabilityError) {
        console.warn('⚠️ RouteManager: Could not update driver availability status:', availabilityError)
        // Don't fail the operation for this
      }

      console.log(`✅ RouteManager: Successfully assigned driver ${driver.first_name} ${driver.last_name} to route`)
      return true
    } catch (error) {
      console.error("❌ RouteManager: Error assigning driver to route:", error)
      return false
    }
  }

  static async deleteRoute(routeId: string): Promise<boolean> {
    try {
      console.log(`🗑️ RouteManager: Deleting route ${routeId}`)

      // First, remove route assignment from orders
      const { error: ordersError } = await supabase
        .from("orders")
        .update({
          route_id: null,
          driver_id: null,
          status: "pending",
          assigned_at: null
        })
        .eq("route_id", routeId)

      if (ordersError) {
        console.error("❌ RouteManager: Error updating orders:", ordersError)
        return false
      }

      // Delete route stops
      const { error: stopsError } = await supabase
        .from("route_stops")
        .delete()
        .eq("route_id", routeId)

      if (stopsError) {
        console.error("⚠️ RouteManager: Warning - Error deleting route stops:", stopsError)
        // Don't fail the entire operation for this
      }

      // Finally, delete the route
      const { error: routeError } = await supabase
        .from("routes")
        .delete()
        .eq("id", routeId)

      if (routeError) {
        console.error("❌ RouteManager: Error deleting route:", routeError)
        return false
      }

      console.log(`✅ RouteManager: Successfully deleted route ${routeId}`)
      return true
    } catch (error) {
      console.error("❌ RouteManager: Error deleting route:", error)
      return false
    }
  }

  /**
   * Get route by ID
   */
  static async getRoute(routeId: string): Promise<Route | null> {
    try {
      const { data: route, error } = await supabase
        .from("routes")
        .select("*")
        .eq("id", routeId)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return null // Route not found
        }
        console.error("Error fetching route:", error)
        return null
      }

      return route
    } catch (error) {
      console.error("RouteManager.getRoute error:", error)
      return null
    }
  }

  /**
   * Get route stops for a route
   */
  static async getRouteStops(routeId: string): Promise<RouteStop[]> {
    try {
      const { data: stops, error } = await supabase
        .from("route_stops")
        .select(`
          *,
          orders (
            id,
            order_number,
            customer_name,
            delivery_address,
            status
          )
        `)
        .eq("route_id", routeId)
        .order("sequence_order")

      if (error) {
        console.error("Error fetching route stops:", error)
        return []
      }

      return (
        stops?.map((stop) => ({
          id: stop.id,
          route_id: stop.route_id,
          order_id: stop.order_id,
          stop_number: stop.stop_number,
          coordinates: [stop.latitude || 0, stop.longitude || 0] as [number, number],
          estimated_time: stop.estimated_time || 15,
          distance_from_previous: stop.distance_from_previous || 0,
          status: stop.status,
          actual_arrival_time: stop.actual_arrival_time,
          notes: stop.notes,
        })) || []
      )
    } catch (error) {
      console.error("RouteManager.getRouteStops error:", error)
      return []
    }
  }

  /**
   * Get all routes with optional filtering
   */
  static async getAllRoutes(adminId?: string): Promise<Route[]> {
    try {
      let query = supabase
        .from("routes")
        .select(`
          *,
          route_stops (
            id,
            stop_number,
            stop_label,
            status
          )
        `)
        .order("created_at", { ascending: false })

      if (adminId) {
        query = query.eq("created_by", adminId)
      }

      const { data: routes, error } = await query

      if (error) {
        console.error("Error fetching routes:", error)
        return []
      }

      return routes || []
    } catch (error) {
      console.error("RouteManager.getAllRoutes error:", error)
      return []
    }
  }

  /**
   * Update route status
   */
  static async updateRouteStatus(routeId: string, status: string): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      if (status === "in_progress") {
        updateData.started_at = new Date().toISOString()
      } else if (status === "completed") {
        updateData.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from("routes")
        .update(updateData)
        .eq("id", routeId)

      if (error) {
        console.error("Error updating route status:", error)
        return false
      }

      return true
    } catch (error) {
      console.error("RouteManager.updateRouteStatus error:", error)
      return false
    }
  }
}
