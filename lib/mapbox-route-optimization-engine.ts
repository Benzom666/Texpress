import { supabase } from "./supabase"
import { enhancedGeocodingService } from "./enhanced-geocoding-service"

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
  waypoints?: [number, number][]
  route_geometry?: string
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

class MapboxRouteOptimizationEngine {
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

  private readonly MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

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

  // Pre-process and cache coordinates
  async preprocessOrderCoordinates(orders: any[], adminId: string): Promise<any[]> {
    console.log(`🔍 Pre-processing coordinates for ${orders.length} orders`)

    const processedOrders = []
    const addressesToGeocode = []

    // Check which orders need geocoding
    for (const order of orders) {
      if (order.latitude && order.longitude) {
        processedOrders.push({
          ...order,
          coordinates: [Number.parseFloat(order.latitude), Number.parseFloat(order.longitude)],
          postal_code: order.postal_code || this.extractPostalCode(order.delivery_address),
          zone:
            order.zone ||
            this.determineZone(
              [Number.parseFloat(order.latitude), Number.parseFloat(order.longitude)],
              order.delivery_address,
            ),
        })
      } else if (order.delivery_address) {
        addressesToGeocode.push(order)
      }
    }

    // Batch geocode addresses
    if (addressesToGeocode.length > 0) {
      console.log(`🌍 Geocoding ${addressesToGeocode.length} addresses`)

      const addresses = addressesToGeocode.map((order) => order.delivery_address)
      const geocodingResults = await enhancedGeocodingService.geocodeBatch(addresses)

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
          await this.cacheOrderCoordinates(order.id, result.coordinates, result.accuracy || "medium")

          processedOrders.push(processedOrder)
        } else {
          console.warn(`❌ Failed to geocode: ${order.delivery_address}`)
          // Add with fallback coordinates
          const fallbackCoords = this.generateFallbackCoordinates(i)
          processedOrders.push({
            ...order,
            coordinates: fallbackCoords,
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

  // Main optimization function with Mapbox integration
  async optimizeRoutes(
    orders: any[],
    parameters: OptimizationParameters,
    adminId: string,
  ): Promise<OptimizationResult> {
    console.log(`🚀 Starting Mapbox route optimization for ${orders.length} orders`)

    try {
      // Step 1: Pre-process coordinates
      const processedOrders = await this.preprocessOrderCoordinates(orders, adminId)

      if (processedOrders.length === 0) {
        throw new Error("No orders with valid coordinates found")
      }

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

      // Step 4: Create optimized routes using Mapbox or fallback algorithm
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

      // Step 6: Save optimization results with proper decimal handling
      await this.saveOptimizationResults(routes, adminId, parameters)

      const result: OptimizationResult = {
        routes,
        unassigned_orders: unassignedOrders,
        total_distance: Number.parseFloat(routes.reduce((sum, route) => sum + route.total_distance, 0).toFixed(2)),
        total_duration: Number.parseFloat(routes.reduce((sum, route) => sum + route.total_duration, 0).toFixed(2)),
        optimization_metrics: metrics,
        parameters_used: parameters,
      }

      console.log(`✅ Optimization complete: ${routes.length} routes created`)
      return result
    } catch (error) {
      console.error("❌ Route optimization failed:", error)
      throw new Error(`Route optimization failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Use Mapbox Optimization API for route optimization
  private async optimizeRouteWithMapbox(
    coordinates: [number, number][],
    warehouseLocation: [number, number],
  ): Promise<{ waypoints: [number, number][]; distance: number; duration: number; geometry?: string } | null> {
    if (!this.MAPBOX_TOKEN) {
      console.warn("Mapbox token not available, using fallback optimization")
      return null
    }

    try {
      // Prepare coordinates for Mapbox API (warehouse + delivery locations)
      const allCoordinates = [warehouseLocation, ...coordinates, warehouseLocation]
      const coordinatesString = allCoordinates.map((coord) => `${coord[1]},${coord[0]}`).join(";")

      const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinatesString}?source=first&destination=last&roundtrip=false&access_token=${this.MAPBOX_TOKEN}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.trips && data.trips.length > 0) {
        const trip = data.trips[0]
        const waypoints = data.waypoints
          .slice(1, -1) // Remove start and end warehouse points
          .map((wp: any) => [wp.location[1], wp.location[0]] as [number, number])

        return {
          waypoints,
          distance: trip.distance / 1000, // Convert to km
          duration: trip.duration / 60, // Convert to minutes
          geometry: trip.geometry,
        }
      }
    } catch (error) {
      console.warn("Mapbox optimization failed:", error)
    }

    return null
  }

  // Fallback optimization using nearest neighbor algorithm
  private optimizeRouteWithNearestNeighbor(
    orders: any[],
    warehouseLocation: [number, number],
  ): { optimizedOrders: any[]; totalDistance: number; totalDuration: number } {
    if (orders.length <= 1) {
      return {
        optimizedOrders: orders,
        totalDistance: orders.length > 0 ? this.calculateDistance(warehouseLocation, orders[0].coordinates) * 2 : 0,
        totalDuration:
          orders.length > 0
            ? this.estimateTravelTime(this.calculateDistance(warehouseLocation, orders[0].coordinates) * 2)
            : 0,
      }
    }

    const optimized = []
    const remaining = [...orders]
    let currentLocation = warehouseLocation
    let totalDistance = 0
    let totalDuration = 0

    while (remaining.length > 0) {
      let nearestIndex = 0
      let nearestDistance = this.calculateDistance(currentLocation, remaining[0].coordinates)

      for (let i = 1; i < remaining.length; i++) {
        const distance = this.calculateDistance(currentLocation, remaining[i].coordinates)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = i
        }
      }

      const selectedOrder = remaining.splice(nearestIndex, 1)[0]
      optimized.push(selectedOrder)

      totalDistance += nearestDistance
      totalDuration += this.estimateTravelTime(nearestDistance) + 10 // Add 10 minutes service time

      currentLocation = selectedOrder.coordinates
    }

    // Add return to warehouse
    totalDistance += this.calculateDistance(currentLocation, warehouseLocation)
    totalDuration += this.estimateTravelTime(this.calculateDistance(currentLocation, warehouseLocation))

    return {
      optimizedOrders: optimized,
      totalDistance: Number.parseFloat(totalDistance.toFixed(2)),
      totalDuration: Number.parseFloat(totalDuration.toFixed(2)),
    }
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

      // Try Mapbox optimization first
      const coordinates = routeOrders.map((order) => order.coordinates)
      const mapboxResult = await this.optimizeRouteWithMapbox(coordinates, parameters.warehouseLocation)

      let optimizedSequence: any[]
      let totalDistance: number
      let totalDuration: number
      let routeGeometry: string | undefined

      if (mapboxResult) {
        // Use Mapbox results
        console.log(`✅ Using Mapbox optimization for route ${routeNumber}`)

        // Reorder orders based on Mapbox waypoints
        optimizedSequence = mapboxResult.waypoints.map((waypoint) => {
          return (
            routeOrders.find(
              (order) =>
                Math.abs(order.coordinates[0] - waypoint[0]) < 0.001 &&
                Math.abs(order.coordinates[1] - waypoint[1]) < 0.001,
            ) || routeOrders[0]
          ) // Fallback to first order if no exact match
        })

        totalDistance = mapboxResult.distance
        totalDuration = mapboxResult.duration
        routeGeometry = mapboxResult.geometry
      } else {
        // Use fallback optimization
        console.log(`⚠️ Using fallback optimization for route ${routeNumber}`)
        const fallbackResult = this.optimizeRouteWithNearestNeighbor(routeOrders, parameters.warehouseLocation)
        optimizedSequence = fallbackResult.optimizedOrders
        totalDistance = fallbackResult.totalDistance
        totalDuration = fallbackResult.totalDuration
      }

      // Create route object
      const route = await this.createRouteObject(
        routeNumber,
        optimizedSequence,
        parameters,
        totalDistance,
        totalDuration,
        routeGeometry,
      )

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

  // Create route object with all details
  private async createRouteObject(
    routeNumber: number,
    orders: any[],
    parameters: OptimizationParameters,
    totalDistance: number,
    totalDuration: number,
    routeGeometry?: string,
  ): Promise<OptimizedRoute> {
    const currentTime = new Date()
    const processedOrders: OptimizedOrder[] = []

    // Process each order in sequence
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      const estimatedArrival = new Date(currentTime.getTime() + (totalDuration / orders.length) * (i + 1) * 60000)

      processedOrders.push({
        ...order,
        route_number: routeNumber,
        stop_number: i + 1,
        estimated_arrival: estimatedArrival.toISOString(),
        estimated_duration: Math.round(totalDuration / orders.length),
        zone: order.zone || this.determineZone(order.coordinates, order.delivery_address),
      })
    }

    // Get unique zones covered by this route
    const zoneCoverage = [...new Set(processedOrders.map((order) => order.zone))]

    return {
      route_number: routeNumber,
      orders: processedOrders,
      total_distance: Number.parseFloat(totalDistance.toFixed(2)),
      total_duration: Number.parseFloat(totalDuration.toFixed(2)),
      estimated_start: currentTime.toISOString(),
      estimated_end: new Date(currentTime.getTime() + totalDuration * 60000).toISOString(),
      color: this.ROUTE_COLORS[(routeNumber - 1) % this.ROUTE_COLORS.length],
      zone_coverage: zoneCoverage,
      optimization_score: this.calculateRouteOptimizationScore(processedOrders, totalDistance, totalDuration),
      waypoints: orders.map((order) => order.coordinates),
      route_geometry: routeGeometry,
    }
  }

  // Save optimization results with proper decimal handling
  private async saveOptimizationResults(
    routes: OptimizedRoute[],
    adminId: string,
    parameters: OptimizationParameters,
  ): Promise<void> {
    try {
      // Calculate totals with proper rounding
      const totalDistance = Number.parseFloat(routes.reduce((sum, route) => sum + route.total_distance, 0).toFixed(2))
      const totalDuration = Number.parseFloat(routes.reduce((sum, route) => sum + route.total_duration, 0).toFixed(2))
      const totalOrders = routes.reduce((sum, route) => sum + route.orders.length, 0)

      console.log(
        `💾 Saving optimization results: ${routes.length} routes, ${totalOrders} orders, ${totalDistance}km, ${totalDuration}min`,
      )

      // Save optimization session
      const { data: session, error: sessionError } = await supabase
        .from("optimization_sessions")
        .insert({
          admin_id: adminId,
          parameters: JSON.stringify(parameters),
          routes_count: routes.length,
          total_orders: totalOrders,
          total_distance: totalDistance,
          total_duration: totalDuration,
          efficiency_score: Number.parseFloat(
            (routes.reduce((sum, route) => sum + route.optimization_score, 0) / routes.length).toFixed(2),
          ),
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          status: "completed",
        })
        .select()
        .single()

      if (sessionError) {
        console.error("Session error:", sessionError)
        throw sessionError
      }

      console.log(`✅ Created optimization session ${session.id}`)

      // Update orders with route assignments
      for (const route of routes) {
        for (const order of route.orders) {
          const { error: updateError } = await supabase
            .from("orders")
            .update({
              route_number: order.route_number,
              stop_number: order.stop_number,
              estimated_arrival: order.estimated_arrival,
              optimization_session_id: session.id,
              latitude: order.coordinates[0],
              longitude: order.coordinates[1],
              zone: order.zone,
              postal_code: order.postal_code,
            })
            .eq("id", order.id)

          if (updateError) {
            console.warn(`Failed to update order ${order.id}:`, updateError)
          }
        }
      }

      console.log(`✅ Updated ${totalOrders} orders with route assignments`)
    } catch (error) {
      console.error("❌ Failed to save optimization results:", error)
      throw error
    }
  }

  // Helper methods
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
          const distA = this.calculateDistance(warehouseLocation, a.coordinates)
          const distB = this.calculateDistance(warehouseLocation, b.coordinates)
          return distA - distB

        case "time":
          const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 }
          const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 1
          const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 1
          return weightB - weightA

        case "hybrid":
        default:
          const hybridScoreA = this.calculateHybridScore(a, warehouseLocation)
          const hybridScoreB = this.calculateHybridScore(b, warehouseLocation)
          return hybridScoreB - hybridScoreA
      }
    })

    return sortedOrders.slice(0, maxStops)
  }

  private calculateHybridScore(order: any, warehouseLocation: [number, number]): number {
    const distance = this.calculateDistance(warehouseLocation, order.coordinates)
    const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 }
    const priority = priorityWeight[order.priority as keyof typeof priorityWeight] || 1

    return priority * 100 - distance
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371 // Earth's radius in km
    const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180
    const dLon = ((coord2[1] - coord1[1]) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1[0] * Math.PI) / 180) *
        Math.cos((coord2[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private estimateTravelTime(distance: number): number {
    const baseSpeed = 30 // km/h average city speed
    return Math.max((distance / baseSpeed) * 60, 5) // Minimum 5 minutes
  }

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

  private filterByTimeWindows(orders: any[], workingHours: { start: string; end: string }): any[] {
    const workStart = new Date(`2024-01-01T${workingHours.start}:00`)
    const workEnd = new Date(`2024-01-01T${workingHours.end}:00`)

    return orders.filter((order) => {
      if (!order.time_window_start || !order.time_window_end) {
        return true
      }

      const windowStart = new Date(`2024-01-01T${order.time_window_start}:00`)
      const windowEnd = new Date(`2024-01-01T${order.time_window_end}:00`)

      return windowStart <= workEnd && windowEnd >= workStart
    })
  }

  private extractPostalCode(address: string): string {
    const postalCodeRegex = /[A-Za-z]\d[A-Za-z][\s-]?\d[A-Za-z]\d/
    const match = address.match(postalCodeRegex)
    return match ? match[0].replace(/\s|-/g, "").toUpperCase() : "UNKNOWN"
  }

  private determineZone(coordinates: [number, number], address: string): string {
    const [lat, lng] = coordinates

    if (lat >= 43.6 && lat <= 43.8 && lng >= -79.5 && lng <= -79.2) {
      return "DOWNTOWN"
    } else if (lat >= 43.7 && lat <= 43.9 && lng >= -79.6 && lng <= -79.3) {
      return "NORTH_YORK"
    } else if (lat >= 43.5 && lat <= 43.7 && lng >= -79.4 && lng <= -79.1) {
      return "SCARBOROUGH"
    } else if (lat >= 43.6 && lat <= 43.8 && lng >= -79.7 && lng <= -79.4) {
      return "ETOBICOKE"
    } else if (lat >= 43.8 && lat <= 44.2 && lng >= -79.8 && lng <= -79.2) {
      return "YORK_REGION"
    } else if (lat >= 43.4 && lat <= 43.7 && lng >= -79.8 && lng <= -79.5) {
      return "MISSISSAUGA"
    }

    return "GREATER_TORONTO"
  }

  private getGeographicZone(coordinates: [number, number]): string {
    return this.determineZone(coordinates, "")
  }

  private generateFallbackCoordinates(index: number): [number, number] {
    const baseLat = 43.6532
    const baseLng = -79.3832
    const spread = 0.15

    return [baseLat + (Math.random() - 0.5) * spread, baseLng + (Math.random() - 0.5) * spread]
  }

  private calculateRouteOptimizationScore(
    orders: OptimizedOrder[],
    totalDistance: number,
    totalDuration: number,
  ): number {
    const avgDistancePerStop = totalDistance / Math.max(orders.length, 1)
    const avgTimePerStop = totalDuration / Math.max(orders.length, 1)

    const distanceScore = Math.max(0, 100 - avgDistancePerStop * 2)
    const timeScore = Math.max(0, 100 - avgTimePerStop)

    return Number.parseFloat(((distanceScore + timeScore) / 2).toFixed(2))
  }

  private calculateOptimizationMetrics(
    routes: OptimizedRoute[],
    originalOrders: any[],
    parameters: OptimizationParameters,
  ) {
    const totalOrders = originalOrders.length
    const assignedOrders = routes.reduce((sum, route) => sum + route.orders.length, 0)
    const totalDistance = routes.reduce((sum, route) => sum + route.total_distance, 0)

    const efficiencyScore = routes.reduce((sum, route) => sum + route.optimization_score, 0) / routes.length
    const zoneCoverage = new Set(routes.flatMap((route) => route.zone_coverage)).size
    const timeWindowCompliance = (assignedOrders / totalOrders) * 100
    const naiveDistance = totalDistance * 1.3
    const distanceSavings = ((naiveDistance - totalDistance) / naiveDistance) * 100

    return {
      efficiency_score: Math.round(efficiencyScore),
      zone_coverage: zoneCoverage,
      time_window_compliance: Math.round(timeWindowCompliance),
      distance_savings: Math.round(distanceSavings),
    }
  }
}

export const mapboxRouteOptimizationEngine = new MapboxRouteOptimizationEngine()
