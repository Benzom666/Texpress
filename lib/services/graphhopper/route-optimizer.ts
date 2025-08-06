import { GraphHopperClient, type Vehicle, type Service, type Solution } from "./graphhopper-client"
import { supabase } from "@/lib/supabase"

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  coordinates?: [number, number]
  priority: "urgent" | "high" | "normal" | "low"
  package_weight?: number
  delivery_window_start?: string
  delivery_window_end?: string
  special_requirements?: string
  delivery_notes?: string
}

interface OptimizationSettings {
  warehouseLocation: [number, number]
  warehouseName: string
  maxOrdersPerRoute: number
  optimizationMethod: "distance" | "time" | "hybrid"
  considerTraffic: boolean
  considerPriority: boolean
  considerTimeWindows: boolean
  vehicleCapacity: number
  workingHours: {
    start: string
    end: string
  }
  vehicleType?: string
  maxRoutes?: number
}

interface OptimizedRoute {
  routeId: string
  routeNumber: string
  vehicleId: string
  driverId?: string
  stops: RouteStop[]
  totalDistance: number
  totalDuration: number
  totalDrivingTime: number
  totalServiceTime: number
  optimizationMetrics: {
    algorithm: string
    processingTime: number
    improvement: number
    unassignedJobs: number
  }
}

interface RouteStop {
  stopNumber: number
  stopLabel: string
  orderId: string
  orderNumber: string
  customerId: string
  customerName: string
  address: string
  coordinates: [number, number]
  estimatedArrival: string
  estimatedDeparture: string
  serviceDuration: number
  instructions?: string
  priority: string
  status: "pending" | "en_route" | "arrived" | "completed" | "failed"
}

export class GraphHopperRouteOptimizer {
  private client: GraphHopperClient
  private adminId: string

  constructor(adminId: string) {
    const apiKey = process.env.GRAPHHOPPER_API_KEY
    if (!apiKey) {
      throw new Error("GRAPHHOPPER_API_KEY environment variable is required")
    }

    this.client = new GraphHopperClient({
      apiKey,
      timeout: 60000, // 60 seconds
    })
    this.adminId = adminId
  }

  /**
   * Optimize routes for multiple orders using GraphHopper
   */
  async optimizeRoutes(orders: Order[], settings: OptimizationSettings, vehicleCount = 1): Promise<OptimizedRoute[]> {
    try {
      console.log(`🚛 Starting GraphHopper optimization for ${orders.length} orders with ${vehicleCount} vehicles`)

      // Validate orders have coordinates
      const validOrders = orders.filter(
        (order) =>
          order.coordinates &&
          order.coordinates.length === 2 &&
          this.client.validateCoordinates(order.coordinates[0], order.coordinates[1]),
      )

      if (validOrders.length === 0) {
        throw new Error("No orders with valid coordinates found")
      }

      if (validOrders.length !== orders.length) {
        console.warn(`⚠️ ${orders.length - validOrders.length} orders skipped due to invalid coordinates`)
      }

      // Create vehicles
      const vehicles = this.createVehicles(vehicleCount, settings)

      // Create services from orders
      const services = this.createServicesFromOrders(validOrders, settings)

      // Create optimization job
      const job = this.client.createOptimizationJob(vehicles, services, {
        objectives: this.getOptimizationObjectives(settings.optimizationMethod),
        calcPoints: true,
        considerTraffic: settings.considerTraffic,
      })

      console.log(`📊 Optimization job created:`)
      console.log(`   - Vehicles: ${vehicles.length}`)
      console.log(`   - Services: ${services.length}`)
      console.log(`   - Method: ${settings.optimizationMethod}`)

      // Submit to GraphHopper and wait for results
      const startTime = Date.now()
      const solution = await this.client.optimizeRoutes(job)
      const processingTime = Date.now() - startTime

      console.log(`✅ GraphHopper optimization completed:`)
      console.log(`   - Processing time: ${processingTime}ms`)
      console.log(`   - Total distance: ${solution.distance.toFixed(2)}m`)
      console.log(`   - Total time: ${solution.time}s`)
      console.log(`   - Routes: ${solution.routes.length}`)
      console.log(`   - Unassigned: ${solution.no_unassigned}`)

      // Convert GraphHopper solution to our route format
      const optimizedRoutes = await this.convertSolutionToRoutes(solution, validOrders, settings, processingTime)

      // Save routes to database
      await this.saveRoutesToDatabase(optimizedRoutes)

      return optimizedRoutes
    } catch (error) {
      console.error("❌ GraphHopper route optimization failed:", error)
      throw error
    }
  }

  /**
   * Create vehicles for optimization
   */
  private createVehicles(vehicleCount: number, settings: OptimizationSettings): Vehicle[] {
    const vehicles: Vehicle[] = []
    const warehouseLocation = settings.warehouseLocation

    // Parse working hours
    const today = new Date()
    const startTime = new Date(today.toDateString() + " " + settings.workingHours.start)
    const endTime = new Date(today.toDateString() + " " + settings.workingHours.end)

    for (let i = 0; i < vehicleCount; i++) {
      const vehicleId = `vehicle_${i + 1}`

      const vehicle = this.client.createVehicle(
        vehicleId,
        settings.vehicleType || "small_truck",
        warehouseLocation,
        warehouseLocation, // Return to warehouse
        {
          earliestStart: startTime,
          latestEnd: endTime,
          maxJobs: settings.maxOrdersPerRoute,
          maxDrivingTime: 8 * 3600, // 8 hours in seconds
          skills: [],
        },
      )

      vehicles.push(vehicle)
    }

    return vehicles
  }

  /**
   * Create services from orders
   */
  private createServicesFromOrders(orders: Order[], settings: OptimizationSettings): Service[] {
    return orders.map((order) => {
      const serviceDuration = this.calculateServiceDuration(order)
      const priority = this.getPriorityValue(order.priority)
      const size = [order.package_weight || 1] // Weight in kg

      // Parse time windows if available
      let timeWindows: Array<{ earliest: Date; latest: Date }> | undefined
      if (settings.considerTimeWindows && order.delivery_window_start && order.delivery_window_end) {
        const today = new Date().toDateString()
        timeWindows = [
          {
            earliest: new Date(today + " " + order.delivery_window_start),
            latest: new Date(today + " " + order.delivery_window_end),
          },
        ]
      }

      return this.client.createService(order.id, order.coordinates!, {
        duration: serviceDuration,
        size,
        priority: settings.considerPriority ? priority : 1,
        timeWindows,
        requiredSkills: this.getRequiredSkills(order),
      })
    })
  }

  /**
   * Get optimization objectives based on method
   */
  private getOptimizationObjectives(method: string): Array<{ type: string; value?: string }> {
    switch (method) {
      case "distance":
        return [{ type: "min", value: "transport_time" }]
      case "time":
        return [{ type: "min", value: "completion_time" }]
      case "hybrid":
      default:
        return [
          { type: "min", value: "completion_time" },
          { type: "min", value: "transport_time" },
        ]
    }
  }

  /**
   * Calculate service duration for an order
   */
  private calculateServiceDuration(order: Order): number {
    let baseDuration = 300 // 5 minutes base

    // Adjust based on priority
    switch (order.priority) {
      case "urgent":
        baseDuration += 120 // Extra 2 minutes for careful handling
        break
      case "high":
        baseDuration += 60
        break
      case "low":
        baseDuration -= 60
        break
    }

    // Adjust based on special requirements
    if (order.special_requirements) {
      baseDuration += 120 // Extra 2 minutes for special handling
    }

    // Adjust based on delivery notes complexity
    if (order.delivery_notes && order.delivery_notes.length > 100) {
      baseDuration += 60 // Extra minute for complex instructions
    }

    return Math.max(baseDuration, 180) // Minimum 3 minutes
  }

  /**
   * Get priority value for GraphHopper
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case "urgent":
        return 4
      case "high":
        return 3
      case "normal":
        return 2
      case "low":
        return 1
      default:
        return 2
    }
  }

  /**
   * Get required skills for an order
   */
  private getRequiredSkills(order: Order): string[] {
    const skills: string[] = []

    if (order.special_requirements) {
      const requirements = order.special_requirements.toLowerCase()
      if (requirements.includes("fragile")) skills.push("fragile_handling")
      if (requirements.includes("refrigerated")) skills.push("refrigerated")
      if (requirements.includes("heavy")) skills.push("heavy_lifting")
    }

    return skills
  }

  /**
   * Convert GraphHopper solution to our route format
   */
  private async convertSolutionToRoutes(
    solution: Solution,
    orders: Order[],
    settings: OptimizationSettings,
    processingTime: number,
  ): Promise<OptimizedRoute[]> {
    const routes: OptimizedRoute[] = []

    for (let routeIndex = 0; routeIndex < solution.routes.length; routeIndex++) {
      const ghRoute = solution.routes[routeIndex]
      const routeNumber = await this.generateRouteNumber(routeIndex + 1)

      // Extract service activities (exclude start/end)
      const serviceActivities = ghRoute.activities.filter((activity) => activity.type === "service" && activity.id)

      const stops: RouteStop[] = []

      for (let stopIndex = 0; stopIndex < serviceActivities.length; stopIndex++) {
        const activity = serviceActivities[stopIndex]
        const order = orders.find((o) => o.id === activity.id)

        if (!order) {
          console.warn(`⚠️ Order not found for activity ${activity.id}`)
          continue
        }

        const stopNumber = stopIndex + 1
        const stopLabel = `S${stopNumber.toString().padStart(2, "0")}`

        const stop: RouteStop = {
          stopNumber,
          stopLabel,
          orderId: order.id,
          orderNumber: order.order_number,
          customerId: order.id, // Using order ID as customer ID for now
          customerName: order.customer_name,
          address: order.delivery_address,
          coordinates: order.coordinates!,
          estimatedArrival: activity.arr_date_time || new Date().toISOString(),
          estimatedDeparture: activity.end_date_time || new Date().toISOString(),
          serviceDuration: this.calculateServiceDuration(order),
          instructions: order.delivery_notes,
          priority: order.priority,
          status: "pending",
        }

        stops.push(stop)
      }

      const route: OptimizedRoute = {
        routeId: crypto.randomUUID(),
        routeNumber,
        vehicleId: ghRoute.vehicle_id,
        stops,
        totalDistance: ghRoute.distance / 1000, // Convert to km
        totalDuration: ghRoute.completion_time,
        totalDrivingTime: ghRoute.transport_time,
        totalServiceTime: ghRoute.service_duration,
        optimizationMetrics: {
          algorithm: "graphhopper",
          processingTime,
          improvement: 0, // Would need baseline to calculate
          unassignedJobs: solution.no_unassigned,
        },
      }

      routes.push(route)
    }

    return routes
  }

  /**
   * Generate unique route number
   */
  private async generateRouteNumber(routeIndex: number): Promise<string> {
    const date = new Date()
    const dateStr =
      date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      date.getDate().toString().padStart(2, "0")

    let counter = 1
    let routeNumber: string

    do {
      routeNumber = `GH${dateStr}-${routeIndex.toString().padStart(2, "0")}-${counter.toString().padStart(3, "0")}`

      // Check if route number exists
      const { data } = await supabase.from("routes").select("id").eq("route_number", routeNumber).single()

      if (!data) break
      counter++
    } while (counter <= 999)

    return routeNumber
  }

  /**
   * Save optimized routes to database
   */
  private async saveRoutesToDatabase(routes: OptimizedRoute[]): Promise<void> {
    try {
      console.log(`💾 Saving ${routes.length} optimized routes to database`)

      for (const route of routes) {
        // Insert route
        const { data: routeData, error: routeError } = await supabase
          .from("routes")
          .insert({
            id: route.routeId,
            route_number: route.routeNumber,
            name: `GraphHopper Route ${route.routeNumber}`,
            created_by: this.adminId,
            total_distance: route.totalDistance,
            total_duration: route.totalDuration,
            total_driving_time: route.totalDrivingTime,
            total_service_time: route.totalServiceTime,
            status: "optimized",
            optimization_settings: JSON.stringify({
              algorithm: "graphhopper",
              vehicle_id: route.vehicleId,
              metrics: route.optimizationMetrics,
            }),
          })
          .select()
          .single()

        if (routeError) {
          console.error("❌ Error saving route:", routeError)
          throw routeError
        }

        // Insert route stops
        const stopsData = route.stops.map((stop) => ({
          route_id: route.routeId,
          order_id: stop.orderId,
          stop_number: stop.stopNumber,
          stop_type: "delivery",
          address: stop.address,
          coordinates: `POINT(${stop.coordinates[1]} ${stop.coordinates[0]})`, // PostGIS format (lon lat)
          estimated_arrival_time: stop.estimatedArrival,
          estimated_departure_time: stop.estimatedDeparture,
          service_duration: stop.serviceDuration,
          instructions: stop.instructions,
          priority: this.getPriorityValue(stop.priority),
          status: stop.status,
        }))

        const { error: stopsError } = await supabase.from("route_stops").insert(stopsData)

        if (stopsError) {
          console.error("❌ Error saving route stops:", stopsError)
          throw stopsError
        }

        // Update orders with route assignment
        const orderIds = route.stops.map((stop) => stop.orderId)
        const { error: ordersError } = await supabase
          .from("orders")
          .update({
            route_id: route.routeId,
            status: "assigned_to_route",
          })
          .in("id", orderIds)

        if (ordersError) {
          console.error("❌ Error updating orders:", ordersError)
          throw ordersError
        }

        // Record optimization history
        await supabase.from("route_optimizations").insert({
          route_id: route.routeId,
          optimization_type: "graphhopper",
          optimization_status: "completed",
          result_data: JSON.stringify({
            totalDistance: route.totalDistance,
            totalDuration: route.totalDuration,
            totalStops: route.stops.length,
            metrics: route.optimizationMetrics,
          }),
          processing_time_ms: route.optimizationMetrics.processingTime,
          total_distance_after: route.totalDistance,
          total_time_after: route.totalDuration,
        })

        console.log(`✅ Saved route ${route.routeNumber} with ${route.stops.length} stops`)
      }

      console.log(`✅ All routes saved successfully`)
    } catch (error) {
      console.error("❌ Error saving routes to database:", error)
      throw error
    }
  }

  /**
   * Get routes with statistics
   */
  async getRoutesWithStats(adminId: string): Promise<any[]> {
    try {
      const { data: routes, error } = await supabase
        .from("routes")
        .select(`
          *,
          route_stops (
            *,
            orders (
              id,
              order_number,
              customer_name
            )
          ),
          route_assignments (
            *
          )
        `)
        .eq("created_by", adminId)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      // Calculate statistics for each route
      const routesWithStats =
        routes?.map((route) => {
          const stops = route.route_stops || []
          const completedStops = stops.filter((stop: any) => stop.status === "completed").length
          const pendingStops = stops.filter((stop: any) =>
            ["pending", "en_route", "arrived"].includes(stop.status),
          ).length
          const failedStops = stops.filter((stop: any) => stop.status === "failed").length

          return {
            ...route,
            stats: {
              total_stops: stops.length,
              completed_stops: completedStops,
              pending_stops: pendingStops,
              failed_stops: failedStops,
              completion_percentage: stops.length > 0 ? (completedStops / stops.length) * 100 : 0,
            },
          }
        }) || []

      return routesWithStats
    } catch (error) {
      console.error("❌ Error fetching routes with stats:", error)
      throw error
    }
  }

  /**
   * Re-optimize an existing route
   */
  async reoptimizeRoute(
    routeId: string,
    newSettings: Partial<OptimizationSettings>,
    reason: string,
  ): Promise<OptimizedRoute> {
    try {
      console.log(`🔄 Re-optimizing route ${routeId}`)

      // Get current route and pending orders
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .select(`
          *,
          route_stops (
            *,
            orders (*)
          )
        `)
        .eq("id", routeId)
        .single()

      if (routeError || !route) {
        throw new Error("Route not found")
      }

      // Get pending orders
      const pendingStops = route.route_stops.filter((stop: any) => ["pending", "en_route"].includes(stop.status))

      if (pendingStops.length === 0) {
        throw new Error("No pending stops to re-optimize")
      }

      const pendingOrders = pendingStops.map((stop: any) => stop.orders)

      // Merge current settings with new settings
      const currentSettings = route.optimization_settings ? JSON.parse(route.optimization_settings) : {}
      const mergedSettings = { ...currentSettings, ...newSettings }

      // Re-optimize with new settings
      const reoptimizedRoutes = await this.optimizeRoutes(
        pendingOrders,
        mergedSettings,
        1, // Single vehicle for re-optimization
      )

      if (reoptimizedRoutes.length === 0) {
        throw new Error("Re-optimization produced no routes")
      }

      const reoptimizedRoute = reoptimizedRoutes[0]

      // Update route in database
      await supabase
        .from("routes")
        .update({
          total_distance: reoptimizedRoute.totalDistance,
          total_duration: reoptimizedRoute.totalDuration,
          total_driving_time: reoptimizedRoute.totalDrivingTime,
          optimization_settings: JSON.stringify(mergedSettings),
          updated_at: new Date().toISOString(),
        })
        .eq("id", routeId)

      // Record re-optimization history
      await supabase.from("route_optimizations").insert({
        route_id: routeId,
        optimization_type: "graphhopper",
        optimization_status: "completed",
        result_data: JSON.stringify({
          reason,
          previousDistance: route.total_distance,
          newDistance: reoptimizedRoute.totalDistance,
          improvement:
            route.total_distance > 0
              ? ((route.total_distance - reoptimizedRoute.totalDistance) / route.total_distance) * 100
              : 0,
        }),
        processing_time_ms: reoptimizedRoute.optimizationMetrics.processingTime,
        total_distance_before: route.total_distance,
        total_distance_after: reoptimizedRoute.totalDistance,
        total_time_before: route.total_duration,
        total_time_after: reoptimizedRoute.totalDuration,
      })

      console.log(`✅ Route ${routeId} re-optimized successfully`)
      return reoptimizedRoute
    } catch (error) {
      console.error("❌ Route re-optimization failed:", error)
      throw error
    }
  }
}
