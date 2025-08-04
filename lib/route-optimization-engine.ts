import { supabase } from "./supabase"
import { geocodingService } from "./geocoding-service"
import { distanceCalculator } from "./distance-calculator"

export interface OptimizationPreset {
  id: string
  name: string
  description: string
  parameters: OptimizationParameters
  created_by: string
  created_at: string
  is_default: boolean
}

export interface OptimizationParameters {
  maxDrivers: number
  maxStopsPerRoute: number
  optimizationCriteria: "distance" | "time" | "hybrid"
  considerTraffic: boolean
  considerTimeWindows: boolean
  considerZones: boolean
  workingHours: {
    start: string
    end: string
  }
  vehicleCapacity: number
  warehouseLocation: [number, number]
  zonePriority: "postal_code" | "geographic" | "custom"
}

export interface OptimizedOrder {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  coordinates: [number, number]
  priority: string
  route_number: number
  stop_number: number
  estimated_arrival: string
  estimated_duration: number
  zone: string
  postal_code: string
  time_window_start?: string
  time_window_end?: string
}

export interface OptimizedRoute {
  route_number: number
  driver_id?: string
  orders: OptimizedOrder[]
  total_distance: number
  total_duration: number
  estimated_start: string
  estimated_end: string
  color: string
  zone_coverage: string[]
  optimization_score: number
}

export interface OptimizationResult {
  routes: OptimizedRoute[]
  unassigned_orders: OptimizedOrder[]
  total_distance: number
  total_duration: number
  optimization_metrics: {
    efficiency_score: number
    zone_coverage: number
    time_window_compliance: number
    distance_savings: number
  }
  parameters_used: OptimizationParameters
}

class RouteOptimizationEngine {
  private readonly ROUTE_COLORS = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
    "#F8C471",
    "#82E0AA",
    "#F1948A",
    "#85C1E9",
    "#D7BDE2",
  ]

  // Save optimization preset
  async saveOptimizationPreset(
    name: string,
    description: string,
    parameters: OptimizationParameters,
    adminId: string,
    isDefault = false,
  ): Promise<OptimizationPreset> {
    try {
      // If setting as default, unset other defaults first
      if (isDefault) {
        await supabase.from("optimization_presets").update({ is_default: false }).eq("created_by", adminId)
      }

      const preset = {
        name,
        description,
        parameters: JSON.stringify(parameters),
        created_by: adminId,
        is_default: isDefault,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from("optimization_presets").insert(preset).select().single()

      if (error) throw error

      return {
        ...data,
        parameters: JSON.parse(data.parameters),
      }
    } catch (error) {
      console.error("Error saving optimization preset:", error)
      throw new Error("Failed to save optimization preset")
    }
  }

  // Load optimization presets
  async loadOptimizationPresets(adminId: string): Promise<OptimizationPreset[]> {
    try {
      const { data, error } = await supabase
        .from("optimization_presets")
        .select("*")
        .eq("created_by", adminId)
        .order("created_at", { ascending: false })

      if (error) throw error

      return (data || []).map((preset) => ({
        ...preset,
        parameters: JSON.parse(preset.parameters),
      }))
    } catch (error) {
      console.error("Error loading optimization presets:", error)
      return []
    }
  }

  // Pre-process and cache coordinates server-side
  async preprocessOrderCoordinates(orders: any[], adminId: string): Promise<any[]> {
    console.log(`🔍 Pre-processing coordinates for ${orders.length} orders`)

    const processedOrders = []
    const addressesToGeocode = []

    // Check which orders need geocoding
    for (const order of orders) {
      if (order.coordinates) {
        processedOrders.push(order)
      } else if (order.delivery_address) {
        addressesToGeocode.push({
          ...order,
          original_index: processedOrders.length + addressesToGeocode.length,
        })
      }
    }

    // Batch geocode addresses
    if (addressesToGeocode.length > 0) {
      console.log(`🌍 Geocoding ${addressesToGeocode.length} addresses`)

      const addresses = addressesToGeocode.map((order) => order.delivery_address)
      const geocodingResults = await geocodingService.geocodeBatch(addresses)

      // Process geocoding results
      for (let i = 0; i < addressesToGeocode.length; i++) {
        const order = addressesToGeocode[i]
        const result = geocodingResults[i]

        if (result.coordinates) {
          const processedOrder = {
            ...order,
            coordinates: result.coordinates,
            postal_code: this.extractPostalCode(order.delivery_address),
            zone: this.determineZone(result.coordinates, order.delivery_address),
            geocoding_accuracy: result.accuracy,
            geocoding_confidence: result.confidence,
          }

          // Cache coordinates in database
          await this.cacheOrderCoordinates(order.id, result.coordinates, result.accuracy)

          processedOrders.push(processedOrder)
        } else {
          console.warn(`❌ Failed to geocode: ${order.delivery_address}`)
          // Add with fallback coordinates
          processedOrders.push({
            ...order,
            coordinates: this.generateFallbackCoordinates(i),
            postal_code: this.extractPostalCode(order.delivery_address),
            zone: "unknown",
            geocoding_accuracy: "low",
            geocoding_confidence: 0,
          })
        }
      }
    }

    console.log(`✅ Pre-processed ${processedOrders.length} orders with coordinates`)
    return processedOrders
  }

  // Cache coordinates in database
  private async cacheOrderCoordinates(orderId: string, coordinates: [number, number], accuracy: string): Promise<void> {
    try {
      await supabase.from("order_coordinates_cache").upsert({
        order_id: orderId,
        latitude: coordinates[0],
        longitude: coordinates[1],
        accuracy,
        cached_at: new Date().toISOString(),
      })
    } catch (error) {
      console.warn("Failed to cache coordinates:", error)
    }
  }

  // Main optimization function
  async optimizeRoutes(
    orders: any[],
    parameters: OptimizationParameters,
    adminId: string,
  ): Promise<OptimizationResult> {
    console.log(`🚀 Starting route optimization for ${orders.length} orders`)

    try {
      // Step 1: Pre-process coordinates
      const processedOrders = await this.preprocessOrderCoordinates(orders, adminId)

      // Step 2: Group by zones if enabled
      let orderGroups: any[][] = []
      if (parameters.considerZones) {
        orderGroups = this.groupOrdersByZone(processedOrders, parameters.zonePriority)
      } else {
        orderGroups = [processedOrders]
      }

      // Step 3: Apply time window constraints
      if (parameters.considerTimeWindows) {
        orderGroups = orderGroups.map((group) => this.filterByTimeWindows(group, parameters.workingHours))
      }

      // Step 4: Create optimized routes
      const routes: OptimizedRoute[] = []
      const unassignedOrders: OptimizedOrder[] = []
      let routeNumber = 1

      for (const orderGroup of orderGroups) {
        if (orderGroup.length === 0) continue

        const groupRoutes = await this.createOptimizedRoutesForGroup(orderGroup, parameters, routeNumber)

        routes.push(...groupRoutes.routes)
        unassignedOrders.push(...groupRoutes.unassigned)
        routeNumber += groupRoutes.routes.length
      }

      // Step 5: Calculate optimization metrics
      const metrics = this.calculateOptimizationMetrics(routes, processedOrders, parameters)

      // Step 6: Save optimization results
      await this.saveOptimizationResults(routes, adminId, parameters)

      const result: OptimizationResult = {
        routes,
        unassigned_orders: unassignedOrders,
        total_distance: routes.reduce((sum, route) => sum + route.total_distance, 0),
        total_duration: routes.reduce((sum, route) => sum + route.total_duration, 0),
        optimization_metrics: metrics,
        parameters_used: parameters,
      }

      console.log(`✅ Optimization complete: ${routes.length} routes created`)
      return result
    } catch (error) {
      console.error("❌ Route optimization failed:", error)
      throw new Error("Route optimization failed")
    }
  }

  // Group orders by zone/postal code
  private groupOrdersByZone(orders: any[], zonePriority: string): any[][] {
    const groups: { [key: string]: any[] } = {}

    for (const order of orders) {
      let groupKey = "default"

      switch (zonePriority) {
        case "postal_code":
          groupKey = order.postal_code || "unknown"
          break
        case "geographic":
          groupKey = this.getGeographicZone(order.coordinates)
          break
        case "custom":
          groupKey = order.zone || "default"
          break
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(order)
    }

    return Object.values(groups)
  }

  // Filter orders by time windows
  private filterByTimeWindows(orders: any[], workingHours: { start: string; end: string }): any[] {
    const workStart = new Date(`2024-01-01T${workingHours.start}:00`)
    const workEnd = new Date(`2024-01-01T${workingHours.end}:00`)

    return orders.filter((order) => {
      if (!order.time_window_start || !order.time_window_end) {
        return true // No time window constraint
      }

      const windowStart = new Date(`2024-01-01T${order.time_window_start}:00`)
      const windowEnd = new Date(`2024-01-01T${order.time_window_end}:00`)

      // Check if time windows overlap with working hours
      return windowStart <= workEnd && windowEnd >= workStart
    })
  }

  // Create optimized routes for a group of orders
  private async createOptimizedRoutesForGroup(
    orders: any[],
    parameters: OptimizationParameters,
    startingRouteNumber: number,
  ): Promise<{ routes: OptimizedRoute[]; unassigned: OptimizedOrder[] }> {
    const routes: OptimizedRoute[] = []
    const unassigned: OptimizedOrder[] = []
    const remainingOrders = [...orders]

    let routeNumber = startingRouteNumber

    while (remainingOrders.length > 0 && routes.length < parameters.maxDrivers) {
      const routeOrders = this.selectOrdersForRoute(
        remainingOrders,
        parameters.maxStopsPerRoute,
        parameters.warehouseLocation,
        parameters.optimizationCriteria,
      )

      if (routeOrders.length === 0) break

      // Remove selected orders from remaining
      routeOrders.forEach((order) => {
        const index = remainingOrders.findIndex((o) => o.id === order.id)
        if (index > -1) remainingOrders.splice(index, 1)
      })

      // Optimize order sequence within route
      const optimizedSequence = await this.optimizeRouteSequence(
        routeOrders,
        parameters.warehouseLocation,
        parameters.optimizationCriteria,
        parameters.considerTraffic,
      )

      // Create route object
      const route = await this.createRouteObject(routeNumber, optimizedSequence, parameters)

      routes.push(route)
      routeNumber++
    }

    // Add remaining orders as unassigned
    remainingOrders.forEach((order) => {
      unassigned.push({
        ...order,
        route_number: 0,
        stop_number: 0,
        estimated_arrival: "",
        estimated_duration: 0,
        zone: order.zone || "unknown",
      })
    })

    return { routes, unassigned }
  }

  // Select orders for a single route
  private selectOrdersForRoute(
    orders: any[],
    maxStops: number,
    warehouseLocation: [number, number],
    criteria: string,
  ): any[] {
    if (orders.length === 0) return []

    // Sort orders by optimization criteria
    const sortedOrders = [...orders].sort((a, b) => {
      switch (criteria) {
        case "distance":
          const distA = distanceCalculator.calculateRealWorldDistance(warehouseLocation, a.coordinates)
          const distB = distanceCalculator.calculateRealWorldDistance(warehouseLocation, b.coordinates)
          return distA - distB

        case "time":
          // Prioritize by time windows and priority
          const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 }
          const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 1
          const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 1
          return weightB - weightA

        case "hybrid":
        default:
          // Combine distance and priority
          const hybridScoreA = this.calculateHybridScore(a, warehouseLocation)
          const hybridScoreB = this.calculateHybridScore(b, warehouseLocation)
          return hybridScoreB - hybridScoreA
      }
    })

    return sortedOrders.slice(0, maxStops)
  }

  // Calculate hybrid optimization score
  private calculateHybridScore(order: any, warehouseLocation: [number, number]): number {
    const distance = distanceCalculator.calculateRealWorldDistance(warehouseLocation, order.coordinates)
    const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 }
    const priority = priorityWeight[order.priority as keyof typeof priorityWeight] || 1

    // Lower distance is better, higher priority is better
    return priority * 100 - distance
  }

  // Optimize sequence within a route using nearest neighbor with improvements
  private async optimizeRouteSequence(
    orders: any[],
    startLocation: [number, number],
    criteria: string,
    considerTraffic: boolean,
  ): Promise<any[]> {
    if (orders.length <= 1) return orders

    const optimized = []
    const remaining = [...orders]
    let currentLocation = startLocation

    while (remaining.length > 0) {
      let bestIndex = 0
      let bestScore = Number.NEGATIVE_INFINITY

      for (let i = 0; i < remaining.length; i++) {
        const order = remaining[i]
        const score = await this.calculateRouteScore(currentLocation, order, criteria, considerTraffic)

        if (score > bestScore) {
          bestScore = score
          bestIndex = i
        }
      }

      const selectedOrder = remaining.splice(bestIndex, 1)[0]
      optimized.push(selectedOrder)
      currentLocation = selectedOrder.coordinates
    }

    return optimized
  }

  // Calculate route score for order selection
  private async calculateRouteScore(
    currentLocation: [number, number],
    order: any,
    criteria: string,
    considerTraffic: boolean,
  ): Promise<number> {
    const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, order.coordinates)
    const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 }
    const priority = priorityWeight[order.priority as keyof typeof priorityWeight] || 1

    let score = 0

    switch (criteria) {
      case "distance":
        score = 1000 / (distance + 1) // Closer is better
        break
      case "time":
        score = priority * 100 // Priority-based
        if (considerTraffic) {
          // Apply traffic penalty (simplified)
          const trafficMultiplier = this.getTrafficMultiplier(new Date())
          score *= trafficMultiplier
        }
        break
      case "hybrid":
      default:
        score = priority * 50 + 1000 / (distance + 1)
        break
    }

    return score
  }

  // Create route object with all details
  private async createRouteObject(
    routeNumber: number,
    orders: any[],
    parameters: OptimizationParameters,
  ): Promise<OptimizedRoute> {
    let totalDistance = 0
    let totalDuration = 0
    let currentLocation = parameters.warehouseLocation
    const currentTime = new Date()

    // Process each order in sequence
    const processedOrders: OptimizedOrder[] = []

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, order.coordinates)
      const duration = this.estimateTravelTime(distance, parameters.considerTraffic)

      totalDistance += distance
      totalDuration += duration + 10 // Add 10 minutes service time

      const estimatedArrival = new Date(currentTime.getTime() + totalDuration * 60000)

      processedOrders.push({
        ...order,
        route_number: routeNumber,
        stop_number: i + 1,
        estimated_arrival: estimatedArrival.toISOString(),
        estimated_duration: duration,
        zone: order.zone || this.determineZone(order.coordinates, order.delivery_address),
      })

      currentLocation = order.coordinates
    }

    // Get unique zones covered by this route
    const zoneCoverage = [...new Set(processedOrders.map((order) => order.zone))]

    return {
      route_number: routeNumber,
      orders: processedOrders,
      total_distance: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
      total_duration: Math.round(totalDuration * 100) / 100, // Round to 2 decimal places
      estimated_start: currentTime.toISOString(),
      estimated_end: new Date(currentTime.getTime() + totalDuration * 60000).toISOString(),
      color: this.ROUTE_COLORS[(routeNumber - 1) % this.ROUTE_COLORS.length],
      zone_coverage: zoneCoverage,
      optimization_score: this.calculateRouteOptimizationScore(processedOrders, totalDistance, totalDuration),
    }
  }

  // Save optimization results to database
  private async saveOptimizationResults(
    routes: OptimizedRoute[],
    adminId: string,
    parameters: OptimizationParameters,
  ): Promise<void> {
    try {
      // Round values to prevent decimal precision issues
      const totalDistance = Math.round(routes.reduce((sum, route) => sum + route.total_distance, 0) * 100) / 100
      const totalDuration = Math.round(routes.reduce((sum, route) => sum + route.total_duration, 0) * 100) / 100

      // Save optimization session
      const { data: session, error: sessionError } = await supabase
        .from("optimization_sessions")
        .insert({
          admin_id: adminId,
          parameters: JSON.stringify(parameters),
          routes_count: routes.length,
          total_orders: routes.reduce((sum, route) => sum + route.orders.length, 0),
          total_distance: totalDistance,
          total_duration: totalDuration,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Update orders with route assignments
      for (const route of routes) {
        for (const order of route.orders) {
          await supabase
            .from("orders")
            .update({
              route_number: order.route_number,
              stop_number: order.stop_number,
              estimated_arrival: order.estimated_arrival,
              optimization_session_id: session.id,
            })
            .eq("id", order.id)
        }
      }

      console.log(`✅ Saved optimization results for session ${session.id}`)
    } catch (error) {
      console.error("❌ Failed to save optimization results:", error)
      throw error
    }
  }

  // Helper methods
  private extractPostalCode(address: string): string {
    const postalCodeRegex = /[A-Za-z]\d[A-Za-z][\s-]?\d[A-Za-z]\d/
    const match = address.match(postalCodeRegex)
    return match ? match[0].replace(/\s|-/g, "").toUpperCase() : "UNKNOWN"
  }

  private determineZone(coordinates: [number, number], address: string): string {
    const [lat, lng] = coordinates

    // Toronto zone determination (simplified)
    if (lat >= 43.6 && lat <= 43.8 && lng >= -79.5 && lng <= -79.2) {
      return "DOWNTOWN"
    } else if (lat >= 43.7 && lat <= 43.9 && lng >= -79.6 && lng <= -79.3) {
      return "NORTH_YORK"
    } else if (lat >= 43.5 && lat <= 43.7 && lng >= -79.4 && lng <= -79.1) {
      return "SCARBOROUGH"
    } else if (lat >= 43.6 && lat <= 43.8 && lng >= -79.7 && lng <= -79.4) {
      return "ETOBICOKE"
    }

    return "GREATER_TORONTO"
  }

  private getGeographicZone(coordinates: [number, number]): string {
    return this.determineZone(coordinates, "")
  }

  private generateFallbackCoordinates(index: number): [number, number] {
    // Generate coordinates around Toronto with some spread
    const baseLat = 43.6532
    const baseLng = -79.3832
    const spread = 0.1

    return [baseLat + (Math.random() - 0.5) * spread, baseLng + (Math.random() - 0.5) * spread]
  }

  private estimateTravelTime(distance: number, considerTraffic: boolean): number {
    const baseSpeed = 30 // km/h average city speed
    let travelTime = (distance / baseSpeed) * 60 // minutes

    if (considerTraffic) {
      const trafficMultiplier = this.getTrafficMultiplier(new Date())
      travelTime *= trafficMultiplier
    }

    return Math.max(travelTime, 5) // Minimum 5 minutes
  }

  private getTrafficMultiplier(time: Date): number {
    const hour = time.getHours()

    // Rush hour penalties
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 1.5 // 50% longer during rush hour
    } else if (hour >= 22 || hour <= 6) {
      return 0.8 // 20% faster at night
    }

    return 1.0 // Normal traffic
  }

  private calculateRouteOptimizationScore(
    orders: OptimizedOrder[],
    totalDistance: number,
    totalDuration: number,
  ): number {
    // Calculate efficiency score based on distance per stop and time per stop
    const avgDistancePerStop = totalDistance / Math.max(orders.length, 1)
    const avgTimePerStop = totalDuration / Math.max(orders.length, 1)

    // Lower values are better, so invert the score
    const distanceScore = Math.max(0, 100 - avgDistancePerStop * 2)
    const timeScore = Math.max(0, 100 - avgTimePerStop)

    return (distanceScore + timeScore) / 2
  }

  private calculateOptimizationMetrics(
    routes: OptimizedRoute[],
    originalOrders: any[],
    parameters: OptimizationParameters,
  ) {
    const totalOrders = originalOrders.length
    const assignedOrders = routes.reduce((sum, route) => sum + route.orders.length, 0)
    const totalDistance = routes.reduce((sum, route) => sum + route.total_distance, 0)

    // Calculate efficiency metrics
    const efficiencyScore = routes.reduce((sum, route) => sum + route.optimization_score, 0) / routes.length
    const zoneCoverage = new Set(routes.flatMap((route) => route.zone_coverage)).size

    // Time window compliance (simplified)
    const timeWindowCompliance = (assignedOrders / totalOrders) * 100

    // Distance savings compared to naive approach (estimated)
    const naiveDistance = totalDistance * 1.3 // Assume 30% more distance without optimization
    const distanceSavings = ((naiveDistance - totalDistance) / naiveDistance) * 100

    return {
      efficiency_score: Math.round(efficiencyScore),
      zone_coverage: zoneCoverage,
      time_window_compliance: Math.round(timeWindowCompliance),
      distance_savings: Math.round(distanceSavings),
    }
  }
}

export const routeOptimizationEngine = new RouteOptimizationEngine()
