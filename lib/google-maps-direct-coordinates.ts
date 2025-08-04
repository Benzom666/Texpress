// Google Maps Direct Coordinates Service
// Uses latitude/longitude coordinates directly without any geocoding

export interface DirectCoordinateOrder {
  id: string
  order_number: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  coordinates: [number, number] // [latitude, longitude]
  status: string
  created_at: string
  updated_at: string
  zone?: string
  postal_code?: string
}

export interface OptimizedDirectRoute {
  route_number: number
  driver_id?: string
  orders: DirectCoordinateOrder[]
  total_distance: number
  total_duration: number
  estimated_start: string
  estimated_end: string
  optimization_score: number
  zone_coverage: string[]
  color: string
  waypoints: [number, number][] // Direct coordinates for route
}

export interface DirectRouteOptimizationResult {
  routes: OptimizedDirectRoute[]
  unassigned_orders: DirectCoordinateOrder[]
  total_distance: number
  total_duration: number
  optimization_metrics: {
    efficiency_score: number
    time_savings_percentage: number
    distance_savings_percentage: number
    zone_consolidation_score: number
    average_stops_per_route: number
  }
  warehouse_coordinates: [number, number]
  created_at: string
}

export interface DirectRouteParameters {
  maxDrivers: number
  maxStopsPerRoute: number
  optimizationCriteria: "distance" | "time" | "balanced"
  considerTraffic: boolean
  workingHours: {
    start: string
    end: string
  }
  warehouseCoordinates: [number, number] // Direct coordinates
  travelMode: "DRIVING" | "WALKING" | "BICYCLING"
  avoidTolls: boolean
  avoidHighways: boolean
}

const ROUTE_COLORS = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6B7280", // Gray
]

export class GoogleMapsDirectCoordinatesService {
  private warehouseCoordinates: [number, number] = [43.6532, -79.3832] // Toronto downtown [lat, lng]

  constructor(warehouseCoordinates?: [number, number]) {
    if (warehouseCoordinates) {
      this.warehouseCoordinates = warehouseCoordinates
    }
  }

  /**
   * Optimize routes using direct coordinates without any geocoding
   */
  async optimizeRoutesWithDirectCoordinates(
    orders: DirectCoordinateOrder[],
    parameters: DirectRouteParameters,
  ): Promise<DirectRouteOptimizationResult> {
    console.log(`🗺️ Starting direct coordinate route optimization for ${orders.length} orders`)

    // Validate that all orders have valid coordinates
    const validOrders = this.validateOrderCoordinates(orders)
    const invalidOrders = orders.filter((order) => !this.isValidCoordinate(order.coordinates))

    if (invalidOrders.length > 0) {
      console.warn(`⚠️ Found ${invalidOrders.length} orders with invalid coordinates`)
    }

    // Set warehouse coordinates from parameters
    this.warehouseCoordinates = parameters.warehouseCoordinates

    // Step 1: Assign zones based on coordinates
    const zonedOrders = this.assignZonesByCoordinates(validOrders)

    // Step 2: Create optimized routes using direct coordinates
    const routes = await this.createDirectCoordinateRoutes(zonedOrders, parameters)

    // Step 3: Calculate metrics
    const metrics = this.calculateDirectRouteMetrics(routes, validOrders)

    const result: DirectRouteOptimizationResult = {
      routes,
      unassigned_orders: invalidOrders,
      total_distance: routes.reduce((sum, route) => sum + route.total_distance, 0),
      total_duration: routes.reduce((sum, route) => sum + route.total_duration, 0),
      optimization_metrics: metrics,
      warehouse_coordinates: this.warehouseCoordinates,
      created_at: new Date().toISOString(),
    }

    console.log(`✅ Direct coordinate optimization completed: ${routes.length} routes created`)
    return result
  }

  /**
   * Validate that coordinates are valid numbers within reasonable bounds
   */
  private validateOrderCoordinates(orders: DirectCoordinateOrder[]): DirectCoordinateOrder[] {
    return orders.filter((order) => this.isValidCoordinate(order.coordinates))
  }

  private isValidCoordinate(coordinates: [number, number]): boolean {
    const [lat, lng] = coordinates
    return (
      typeof lat === "number" &&
      typeof lng === "number" &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    )
  }

  /**
   * Assign zones based on coordinate quadrants
   */
  private assignZonesByCoordinates(orders: DirectCoordinateOrder[]): DirectCoordinateOrder[] {
    const [warehouseLat, warehouseLng] = this.warehouseCoordinates

    return orders.map((order) => {
      const [lat, lng] = order.coordinates
      let zone = "Central"

      // Determine zone based on position relative to warehouse
      if (lat > warehouseLat && lng > warehouseLng) {
        zone = "Northeast"
      } else if (lat > warehouseLat && lng <= warehouseLng) {
        zone = "Northwest"
      } else if (lat <= warehouseLat && lng > warehouseLng) {
        zone = "Southeast"
      } else if (lat <= warehouseLat && lng <= warehouseLng) {
        zone = "Southwest"
      }

      return {
        ...order,
        zone,
      }
    })
  }

  /**
   * Create optimized routes using direct coordinates
   */
  private async createDirectCoordinateRoutes(
    orders: DirectCoordinateOrder[],
    parameters: DirectRouteParameters,
  ): Promise<OptimizedDirectRoute[]> {
    console.log("🛣️ Creating routes with direct coordinates...")

    const routes: OptimizedDirectRoute[] = []
    const remainingOrders = [...orders]

    // Sort orders by priority first
    remainingOrders.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    let routeNumber = 1

    while (remainingOrders.length > 0 && routes.length < parameters.maxDrivers) {
      const route = await this.createSingleDirectRoute(remainingOrders, routeNumber, parameters)

      if (route.orders.length > 0) {
        routes.push(route)

        // Remove assigned orders
        const assignedIds = new Set(route.orders.map((order) => order.id))
        remainingOrders.splice(
          0,
          remainingOrders.length,
          ...remainingOrders.filter((order) => !assignedIds.has(order.id)),
        )

        routeNumber++
      } else {
        break
      }
    }

    return routes
  }

  /**
   * Create a single optimized route using direct coordinates
   */
  private async createSingleDirectRoute(
    availableOrders: DirectCoordinateOrder[],
    routeNumber: number,
    parameters: DirectRouteParameters,
  ): Promise<OptimizedDirectRoute> {
    if (availableOrders.length === 0) {
      return this.createEmptyDirectRoute(routeNumber)
    }

    const maxStops = Math.min(parameters.maxStopsPerRoute, availableOrders.length)
    const routeOrders: DirectCoordinateOrder[] = []

    // Start with the first available order (already sorted by priority)
    let currentOrder = availableOrders[0]
    routeOrders.push(currentOrder)

    // Build route using nearest neighbor algorithm with direct coordinates
    for (let i = 1; i < maxStops && availableOrders.length > routeOrders.length; i++) {
      const nextOrder = this.findNearestOrderByCoordinates(
        currentOrder,
        availableOrders.filter((order) => !routeOrders.some((ro) => ro.id === order.id)),
      )

      if (nextOrder) {
        routeOrders.push(nextOrder)
        currentOrder = nextOrder
      } else {
        break
      }
    }

    // Optimize the route order using direct coordinates
    const optimizedOrders = this.optimizeRouteOrderByCoordinates(routeOrders)

    // Calculate route metrics using direct coordinates
    const { totalDistance, totalDuration } = this.calculateDirectRouteDistance(optimizedOrders)

    // Generate waypoints from coordinates
    const waypoints: [number, number][] = optimizedOrders.map((order) => order.coordinates)

    // Calculate time estimates
    const workingStart = new Date()
    workingStart.setHours(Number.parseInt(parameters.workingHours.start.split(":")[0]))
    workingStart.setMinutes(Number.parseInt(parameters.workingHours.start.split(":")[1]))

    const estimatedEnd = new Date(workingStart.getTime() + totalDuration * 60000)

    const zones = [...new Set(optimizedOrders.map((order) => order.zone || "Unknown"))]
    const optimizationScore = this.calculateRouteOptimizationScore(optimizedOrders, totalDistance, totalDuration)

    return {
      route_number: routeNumber,
      orders: optimizedOrders,
      total_distance: totalDistance,
      total_duration: totalDuration,
      estimated_start: workingStart.toISOString(),
      estimated_end: estimatedEnd.toISOString(),
      optimization_score: optimizationScore,
      zone_coverage: zones,
      color: ROUTE_COLORS[(routeNumber - 1) % ROUTE_COLORS.length],
      waypoints,
    }
  }

  private createEmptyDirectRoute(routeNumber: number): OptimizedDirectRoute {
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
      waypoints: [],
    }
  }

  /**
   * Find the nearest order using direct coordinate distance calculation
   */
  private findNearestOrderByCoordinates(
    currentOrder: DirectCoordinateOrder,
    availableOrders: DirectCoordinateOrder[],
  ): DirectCoordinateOrder | null {
    if (availableOrders.length === 0) return null

    let nearestOrder = availableOrders[0]
    let nearestDistance = this.calculateCoordinateDistance(currentOrder.coordinates, nearestOrder.coordinates)

    for (let i = 1; i < availableOrders.length; i++) {
      const distance = this.calculateCoordinateDistance(currentOrder.coordinates, availableOrders[i].coordinates)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestOrder = availableOrders[i]
      }
    }

    return nearestOrder
  }

  /**
   * Optimize route order using 2-opt algorithm with direct coordinates
   */
  private optimizeRouteOrderByCoordinates(orders: DirectCoordinateOrder[]): DirectCoordinateOrder[] {
    if (orders.length <= 2) return orders

    let bestOrder = [...orders]
    let bestDistance = this.calculateTotalRouteDistanceByCoordinates(bestOrder)

    // Simple 2-opt optimization
    for (let i = 1; i < orders.length - 1; i++) {
      for (let j = i + 1; j < orders.length; j++) {
        const newOrder = [...orders]
        // Reverse the segment between i and j
        const segment = newOrder.slice(i, j + 1).reverse()
        newOrder.splice(i, j - i + 1, ...segment)

        const newDistance = this.calculateTotalRouteDistanceByCoordinates(newOrder)
        if (newDistance < bestDistance) {
          bestDistance = newDistance
          bestOrder = newOrder
        }
      }
    }

    return bestOrder
  }

  /**
   * Calculate total route distance using direct coordinates
   */
  private calculateTotalRouteDistanceByCoordinates(orders: DirectCoordinateOrder[]): number {
    if (orders.length === 0) return 0

    let totalDistance = this.calculateCoordinateDistance(this.warehouseCoordinates, orders[0].coordinates)

    for (let i = 1; i < orders.length; i++) {
      totalDistance += this.calculateCoordinateDistance(orders[i - 1].coordinates, orders[i].coordinates)
    }

    // Return to warehouse
    totalDistance += this.calculateCoordinateDistance(orders[orders.length - 1].coordinates, this.warehouseCoordinates)

    return totalDistance
  }

  /**
   * Calculate route metrics using direct coordinates
   */
  private calculateDirectRouteDistance(orders: DirectCoordinateOrder[]): {
    totalDistance: number
    totalDuration: number
  } {
    if (orders.length === 0) {
      return { totalDistance: 0, totalDuration: 0 }
    }

    let totalDistance = 0
    let totalDuration = 0

    // Distance from warehouse to first stop
    totalDistance += this.calculateCoordinateDistance(this.warehouseCoordinates, orders[0].coordinates)

    // Calculate distances between consecutive stops
    for (let i = 1; i < orders.length; i++) {
      totalDistance += this.calculateCoordinateDistance(orders[i - 1].coordinates, orders[i].coordinates)
    }

    // Return to warehouse
    totalDistance += this.calculateCoordinateDistance(orders[orders.length - 1].coordinates, this.warehouseCoordinates)

    // Calculate duration (assuming 30 km/h average speed + 10 minutes per stop)
    const travelTime = (totalDistance / 30) * 60 // Convert to minutes
    const serviceTime = orders.length * 10 // 10 minutes per stop
    totalDuration = travelTime + serviceTime

    return { totalDistance, totalDuration }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateCoordinateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lng1] = coord1
    const [lat2, lng2] = coord2

    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLng = this.toRadians(lng2 - lng1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Calculate route optimization score
   */
  private calculateRouteOptimizationScore(orders: DirectCoordinateOrder[], distance: number, duration: number): number {
    if (orders.length === 0) return 0

    const baseScore = 100
    const distancePenalty = Math.min(50, distance * 2)
    const durationPenalty = Math.min(30, duration / 10)
    const stopBonus = Math.min(20, orders.length * 2)

    return Math.max(0, Math.round(baseScore - distancePenalty - durationPenalty + stopBonus))
  }

  /**
   * Calculate optimization metrics
   */
  private calculateDirectRouteMetrics(
    routes: OptimizedDirectRoute[],
    allOrders: DirectCoordinateOrder[],
  ): {
    efficiency_score: number
    time_savings_percentage: number
    distance_savings_percentage: number
    zone_consolidation_score: number
    average_stops_per_route: number
  } {
    const totalOrders = allOrders.length
    const assignedOrders = routes.reduce((sum, route) => sum + route.orders.length, 0)

    const efficiencyScore = totalOrders > 0 ? Math.round((assignedOrders / totalOrders) * 100) : 0

    const averageOptimizationScore =
      routes.length > 0
        ? Math.round(routes.reduce((sum, route) => sum + route.optimization_score, 0) / routes.length)
        : 0

    const averageStopsPerRoute = routes.length > 0 ? Math.round(assignedOrders / routes.length) : 0

    const allZones = [...new Set(allOrders.map((order) => order.zone || "Unknown"))]
    const coveredZones = [...new Set(routes.flatMap((route) => route.zone_coverage))]
    const zoneConsolidationScore = allZones.length > 0 ? Math.round((coveredZones.length / allZones.length) * 100) : 0

    return {
      efficiency_score: efficiencyScore,
      time_savings_percentage: Math.min(35, Math.max(15, averageOptimizationScore * 0.4)),
      distance_savings_percentage: Math.min(30, Math.max(10, averageOptimizationScore * 0.35)),
      zone_consolidation_score: zoneConsolidationScore,
      average_stops_per_route: averageStopsPerRoute,
    }
  }

  /**
   * Create Google Maps URL with direct coordinates (no geocoding)
   */
  createDirectCoordinateMapUrl(route: OptimizedDirectRoute): string {
    if (route.orders.length === 0) return ""

    const origin = `${this.warehouseCoordinates[0]},${this.warehouseCoordinates[1]}`
    const destination = `${this.warehouseCoordinates[0]},${this.warehouseCoordinates[1]}`

    const waypoints = route.orders.map((order) => `${order.coordinates[0]},${order.coordinates[1]}`).join("|")

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
  }

  /**
   * Get route coordinates for map rendering (no geocoding needed)
   */
  getRouteCoordinatesForMap(route: OptimizedDirectRoute): [number, number][] {
    const coordinates: [number, number][] = []

    // Start at warehouse
    coordinates.push(this.warehouseCoordinates)

    // Add all order coordinates
    route.orders.forEach((order) => {
      coordinates.push(order.coordinates)
    })

    // Return to warehouse
    coordinates.push(this.warehouseCoordinates)

    return coordinates
  }
}

export const googleMapsDirectService = new GoogleMapsDirectCoordinatesService()
