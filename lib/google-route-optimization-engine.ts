import { fallbackGeocodingService, type GeocodingStats } from "./fallback-geocoding-service"

export interface OptimizedOrder {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  coordinates: [number, number]
  stop_number: number
  estimated_arrival: string
  estimated_duration: number
  zone: string
  geocoding_accuracy?: string
  geocoding_source?: string
}

export interface OptimizedRoute {
  route_number: number
  driver_id?: string
  orders: OptimizedOrder[]
  total_distance: number
  total_duration: number
  estimated_start: string
  estimated_end: string
  optimization_score: number
  zone_coverage: string[]
  color: string
}

export interface OptimizationMetrics {
  efficiency_score: number
  time_window_compliance: number
  distance_savings: number
  zone_coverage: number
}

export interface OptimizationParameters {
  maxDrivers: number
  maxStopsPerRoute: number
  optimizationCriteria: "distance" | "time" | "balanced"
  considerTraffic: boolean
  considerTimeWindows: boolean
  considerZones: boolean
  zonePriority: "strict" | "preferred" | "none"
  workingHours: {
    start: string
    end: string
  }
}

export interface OptimizationResult {
  routes: OptimizedRoute[]
  unassigned_orders: OptimizedOrder[]
  total_distance: number
  total_duration: number
  optimization_metrics: OptimizationMetrics
  geocoding_stats: GeocodingStats
  parameters_used: OptimizationParameters
  created_at: string
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  coordinates?: [number, number]
  delivery_window_start?: string
  delivery_window_end?: string
  special_requirements?: string
  zone?: string
}

const ROUTE_COLORS = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#8B5CF6", // Purple
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#EC4899", // Pink
  "#6B7280", // Gray
]

class GoogleRouteOptimizationEngine {
  private warehouseLocation: [number, number] = [-79.3832, 43.6532] // Toronto downtown

  async optimizeRoutes(orders: Order[], parameters: OptimizationParameters): Promise<OptimizationResult> {
    console.log(`🚀 Starting route optimization for ${orders.length} orders`)

    // Step 1: Geocode all orders
    const geocodedOrders = await this.geocodeOrders(orders)
    const geocodingStats: GeocodingStats = fallbackGeocodingService.getStats()

    // Step 2: Zone assignment
    const zonedOrders = this.assignZones(geocodedOrders)

    // Step 3: Priority sorting
    const sortedOrders = this.sortOrdersByPriority(zonedOrders)

    // Step 4: Route creation
    const routes = this.createOptimizedRoutes(sortedOrders, parameters)

    // Step 5: Calculate metrics
    const metrics = this.calculateOptimizationMetrics(routes, sortedOrders)

    // Step 6: Identify unassigned orders
    const assignedOrderIds = new Set(routes.flatMap((route) => route.orders.map((order) => order.id)))
    const unassignedOrders = sortedOrders.filter((order) => !assignedOrderIds.has(order.id))

    const totalDistance = routes.reduce((sum, route) => sum + route.total_distance, 0)
    const totalDuration = routes.reduce((sum, route) => sum + route.total_duration, 0)

    console.log(`✅ Optimization complete: ${routes.length} routes, ${unassignedOrders.length} unassigned`)

    return {
      routes,
      unassigned_orders: unassignedOrders,
      total_distance: totalDistance,
      total_duration: totalDuration,
      optimization_metrics: metrics,
      geocoding_stats,
      parameters_used: parameters,
      created_at: new Date().toISOString(),
    }
  }

  private async geocodeOrders(orders: Order[]): Promise<OptimizedOrder[]> {
    const geocodedOrders: OptimizedOrder[] = []

    for (const order of orders) {
      let coordinates = order.coordinates
      let geocodingAccuracy = "high"
      let geocodingSource = "database"

      if (!coordinates) {
        const result = await fallbackGeocodingService.geocode(order.delivery_address)
        coordinates = result.coordinates || [-79.3832, 43.6532] // Default to Toronto downtown
        geocodingAccuracy = result.accuracy
        geocodingSource = result.source
      }

      geocodedOrders.push({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        delivery_address: order.delivery_address,
        priority: order.priority,
        coordinates: coordinates!,
        stop_number: 0, // Will be set during route creation
        estimated_arrival: new Date().toISOString(), // Will be calculated
        estimated_duration: 0, // Will be calculated
        zone: order.zone || this.determineZone(coordinates!),
        geocoding_accuracy: geocodingAccuracy,
        geocoding_source: geocodingSource,
      })
    }

    return geocodedOrders
  }

  private assignZones(orders: OptimizedOrder[]): OptimizedOrder[] {
    return orders.map((order) => ({
      ...order,
      zone: order.zone || this.determineZone(order.coordinates),
    }))
  }

  private determineZone(coordinates: [number, number]): string {
    const [lng, lat] = coordinates

    // Simple zone determination based on coordinates
    if (lng > -79.35 && lat > 43.65) return "North-East"
    if (lng > -79.35 && lat <= 43.65) return "South-East"
    if (lng <= -79.35 && lat > 43.65) return "North-West"
    return "South-West"
  }

  private sortOrdersByPriority(orders: OptimizedOrder[]): OptimizedOrder[] {
    const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
    return [...orders].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
  }

  private createOptimizedRoutes(orders: OptimizedOrder[], parameters: OptimizationParameters): OptimizedRoute[] {
    const routes: OptimizedRoute[] = []
    const remainingOrders = [...orders]
    let routeNumber = 1

    while (remainingOrders.length > 0 && routes.length < parameters.maxDrivers) {
      const route = this.createSingleRoute(remainingOrders, routeNumber, parameters)

      if (route.orders.length > 0) {
        routes.push(route)

        // Remove assigned orders from remaining orders
        const assignedIds = new Set(route.orders.map((order) => order.id))
        remainingOrders.splice(
          0,
          remainingOrders.length,
          ...remainingOrders.filter((order) => !assignedIds.has(order.id)),
        )

        routeNumber++
      } else {
        break // No more orders can be assigned
      }
    }

    return routes
  }

  private createSingleRoute(
    availableOrders: OptimizedOrder[],
    routeNumber: number,
    parameters: OptimizationParameters,
  ): OptimizedRoute {
    const routeOrders: OptimizedOrder[] = []
    const maxStops = Math.min(parameters.maxStopsPerRoute, availableOrders.length)

    if (availableOrders.length === 0) {
      return this.createEmptyRoute(routeNumber)
    }

    // Start with the highest priority order
    let currentOrder = availableOrders[0]
    routeOrders.push(currentOrder)

    // Build route using nearest neighbor with zone preference
    for (let i = 1; i < maxStops && availableOrders.length > routeOrders.length; i++) {
      const nextOrder = this.findNextBestOrder(
        currentOrder,
        availableOrders.filter((order) => !routeOrders.some((ro) => ro.id === order.id)),
        parameters,
      )

      if (nextOrder) {
        routeOrders.push(nextOrder)
        currentOrder = nextOrder
      } else {
        break
      }
    }

    // Optimize the order of stops
    const optimizedOrders = this.optimizeStopOrder(routeOrders)

    // Calculate route metrics
    const { totalDistance, totalDuration, estimatedTimes } = this.calculateRouteMetrics(optimizedOrders)

    // Assign stop numbers and estimated arrival times
    optimizedOrders.forEach((order, index) => {
      order.stop_number = index + 1
      order.estimated_arrival = estimatedTimes[index]
      order.estimated_duration =
        index === 0 ? 0 : this.calculateTravelTime(optimizedOrders[index - 1].coordinates, order.coordinates)
    })

    const zones = [...new Set(optimizedOrders.map((order) => order.zone))]
    const optimizationScore = this.calculateRouteOptimizationScore(optimizedOrders, totalDistance, totalDuration)

    return {
      route_number: routeNumber,
      orders: optimizedOrders,
      total_distance: totalDistance,
      total_duration: totalDuration,
      estimated_start: this.calculateRouteStartTime(parameters.workingHours.start),
      estimated_end: this.calculateRouteEndTime(parameters.workingHours.start, totalDuration),
      optimization_score: optimizationScore,
      zone_coverage: zones,
      color: ROUTE_COLORS[(routeNumber - 1) % ROUTE_COLORS.length],
    }
  }

  private createEmptyRoute(routeNumber: number): OptimizedRoute {
    return {
      route_number: routeNumber,
      orders: [],
      total_distance: 0,
      total_duration: 0,
      estimated_start: new Date().toISOString(),
      estimated_end: new Date().toISOString(),
      optimization_score: 0,
      zone_coverage: [],
      color: ROUTE_COLORS[(routeNumber - 1) % ROUTE_COLORS.length],
    }
  }

  private findNextBestOrder(
    currentOrder: OptimizedOrder,
    availableOrders: OptimizedOrder[],
    parameters: OptimizationParameters,
  ): OptimizedOrder | null {
    if (availableOrders.length === 0) return null

    let bestOrder = availableOrders[0]
    let bestScore = this.calculateOrderScore(currentOrder, bestOrder, parameters)

    for (let i = 1; i < availableOrders.length; i++) {
      const score = this.calculateOrderScore(currentOrder, availableOrders[i], parameters)
      if (score > bestScore) {
        bestScore = score
        bestOrder = availableOrders[i]
      }
    }

    return bestOrder
  }

  private calculateOrderScore(
    currentOrder: OptimizedOrder,
    candidateOrder: OptimizedOrder,
    parameters: OptimizationParameters,
  ): number {
    const distance = this.calculateDistance(currentOrder.coordinates, candidateOrder.coordinates)
    const distanceScore = Math.max(0, 100 - distance * 10) // Closer is better

    const priorityScore = { urgent: 100, high: 75, normal: 50, low: 25 }[candidateOrder.priority]

    const zoneScore = parameters.considerZones && currentOrder.zone === candidateOrder.zone ? 50 : 0

    return distanceScore + priorityScore + zoneScore
  }

  private optimizeStopOrder(orders: OptimizedOrder[]): OptimizedOrder[] {
    if (orders.length <= 2) return orders

    // Simple 2-opt optimization
    let bestOrder = [...orders]
    let bestDistance = this.calculateTotalRouteDistance(bestOrder)

    for (let i = 1; i < orders.length - 1; i++) {
      for (let j = i + 1; j < orders.length; j++) {
        const newOrder = [...orders]
        // Reverse the segment between i and j
        const segment = newOrder.slice(i, j + 1).reverse()
        newOrder.splice(i, j - i + 1, ...segment)

        const newDistance = this.calculateTotalRouteDistance(newOrder)
        if (newDistance < bestDistance) {
          bestDistance = newDistance
          bestOrder = newOrder
        }
      }
    }

    return bestOrder
  }

  private calculateTotalRouteDistance(orders: OptimizedOrder[]): number {
    if (orders.length === 0) return 0

    let totalDistance = this.calculateDistance(this.warehouseLocation, orders[0].coordinates)

    for (let i = 1; i < orders.length; i++) {
      totalDistance += this.calculateDistance(orders[i - 1].coordinates, orders[i].coordinates)
    }

    // Return to warehouse
    totalDistance += this.calculateDistance(orders[orders.length - 1].coordinates, this.warehouseLocation)

    return totalDistance
  }

  private calculateRouteMetrics(orders: OptimizedOrder[]) {
    if (orders.length === 0) {
      return { totalDistance: 0, totalDuration: 0, estimatedTimes: [] }
    }

    let totalDistance = 0
    let totalDuration = 0
    const estimatedTimes: string[] = []

    // Start time (8 AM)
    const currentTime = new Date()
    currentTime.setHours(8, 0, 0, 0)

    // Travel from warehouse to first stop
    const firstDistance = this.calculateDistance(this.warehouseLocation, orders[0].coordinates)
    const firstTravelTime = this.calculateTravelTime(this.warehouseLocation, orders[0].coordinates)

    totalDistance += firstDistance
    totalDuration += firstTravelTime
    currentTime.setMinutes(currentTime.getMinutes() + firstTravelTime)
    estimatedTimes.push(currentTime.toISOString())

    // Calculate subsequent stops
    for (let i = 1; i < orders.length; i++) {
      const distance = this.calculateDistance(orders[i - 1].coordinates, orders[i].coordinates)
      const travelTime = this.calculateTravelTime(orders[i - 1].coordinates, orders[i].coordinates)
      const serviceTime = 10 // 10 minutes per stop

      totalDistance += distance
      totalDuration += travelTime + serviceTime
      currentTime.setMinutes(currentTime.getMinutes() + travelTime + serviceTime)
      estimatedTimes.push(currentTime.toISOString())
    }

    // Return to warehouse
    const returnDistance = this.calculateDistance(orders[orders.length - 1].coordinates, this.warehouseLocation)
    const returnTime = this.calculateTravelTime(orders[orders.length - 1].coordinates, this.warehouseLocation)

    totalDistance += returnDistance
    totalDuration += returnTime

    return { totalDistance, totalDuration, estimatedTimes }
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lng1, lat1] = coord1
    const [lng2, lat2] = coord2

    const R = 6371 // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private calculateTravelTime(coord1: [number, number], coord2: [number, number]): number {
    const distance = this.calculateDistance(coord1, coord2)
    const averageSpeed = 30 // km/h in city traffic
    return Math.round((distance / averageSpeed) * 60) // Convert to minutes
  }

  private calculateRouteOptimizationScore(orders: OptimizedOrder[], distance: number, duration: number): number {
    if (orders.length === 0) return 0

    const baseScore = 100
    const distancePenalty = Math.min(50, distance * 2) // Penalty for long routes
    const durationPenalty = Math.min(30, duration / 10) // Penalty for long duration
    const stopBonus = Math.min(20, orders.length * 2) // Bonus for more stops

    return Math.max(0, Math.round(baseScore - distancePenalty - durationPenalty + stopBonus))
  }

  private calculateRouteStartTime(workingHoursStart: string): string {
    const startTime = new Date()
    const [hours, minutes] = workingHoursStart.split(":").map(Number)
    startTime.setHours(hours, minutes, 0, 0)
    return startTime.toISOString()
  }

  private calculateRouteEndTime(workingHoursStart: string, totalDuration: number): string {
    const startTime = new Date()
    const [hours, minutes] = workingHoursStart.split(":").map(Number)
    startTime.setHours(hours, minutes, 0, 0)
    startTime.setMinutes(startTime.getMinutes() + totalDuration)
    return startTime.toISOString()
  }

  private calculateOptimizationMetrics(routes: OptimizedRoute[], allOrders: OptimizedOrder[]): OptimizationMetrics {
    const totalOrders = allOrders.length
    const assignedOrders = routes.reduce((sum, route) => sum + route.orders.length, 0)

    const efficiencyScore = totalOrders > 0 ? Math.round((assignedOrders / totalOrders) * 100) : 0

    const averageOptimizationScore =
      routes.length > 0
        ? Math.round(routes.reduce((sum, route) => sum + route.optimization_score, 0) / routes.length)
        : 0

    const allZones = [...new Set(allOrders.map((order) => order.zone))]
    const coveredZones = [...new Set(routes.flatMap((route) => route.zone_coverage))]
    const zoneCoverage = allZones.length > 0 ? coveredZones.length : 0

    return {
      efficiency_score: efficiencyScore,
      time_window_compliance: 95, // Placeholder - would be calculated based on actual time windows
      distance_savings: Math.max(0, averageOptimizationScore - 50), // Estimate based on optimization score
      zone_coverage: zoneCoverage,
    }
  }
}

export const googleRouteOptimizationEngine = new GoogleRouteOptimizationEngine()
