import { type NextRequest, NextResponse } from "next/server"

interface OptimizationRequest {
  orders: Array<{
    id: string
    order_number: string
    customer_name: string
    delivery_address: string
    coordinates?: [number, number]
    priority: "urgent" | "high" | "normal" | "low"
    status: string
  }>
  warehouseLocation: [number, number]
  settings: {
    maxOrdersPerRoute: number
    optimizationMethod: "distance" | "time" | "hybrid"
    considerPriority: boolean
    considerTimeWindows: boolean
    vehicleCapacity: number
    workingHours: {
      start: string
      end: string
    }
  }
}

interface OptimizedRoute {
  id: string
  name: string
  orders: Array<{
    id: string
    order_number: string
    customer_name: string
    delivery_address: string
    coordinates: [number, number]
    priority: string
    estimatedArrival: string
    distanceFromPrevious: number
    timeFromPrevious: number
  }>
  totalDistance: number
  totalTime: number
  estimatedDuration: string
  waypoints: Array<[number, number]>
}

export async function POST(request: NextRequest) {
  try {
    console.log("🚚 Starting route optimization...")

    const body: OptimizationRequest = await request.json()
    const { orders, warehouseLocation, settings } = body

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No orders provided for optimization" }, { status: 400 })
    }

    if (!warehouseLocation || warehouseLocation.length !== 2) {
      return NextResponse.json({ error: "Invalid warehouse location" }, { status: 400 })
    }

    console.log(`📦 Optimizing ${orders.length} orders from warehouse at [${warehouseLocation.join(", ")}]`)

    // Filter orders that have coordinates
    const ordersWithCoordinates = orders.filter(
      (order) =>
        order.coordinates &&
        Array.isArray(order.coordinates) &&
        order.coordinates.length === 2 &&
        !isNaN(order.coordinates[0]) &&
        !isNaN(order.coordinates[1]),
    )

    if (ordersWithCoordinates.length === 0) {
      return NextResponse.json(
        {
          error: "No orders with valid coordinates found",
          suggestion: "Please geocode your orders first",
        },
        { status: 400 },
      )
    }

    console.log(`📍 Found ${ordersWithCoordinates.length} orders with valid coordinates`)

    // Sort orders by priority if enabled
    const sortedOrders = [...ordersWithCoordinates]
    if (settings.considerPriority) {
      const priorityWeight = { urgent: 4, high: 3, normal: 2, low: 1 }
      sortedOrders.sort((a, b) => {
        const weightA = priorityWeight[a.priority] || 2
        const weightB = priorityWeight[b.priority] || 2
        return weightB - weightA
      })
    }

    // Create optimized routes using MyRouteOnline-inspired algorithm
    const optimizedRoutes = await createOptimizedRoutes(sortedOrders, warehouseLocation, settings)

    console.log(`✅ Generated ${optimizedRoutes.length} optimized routes`)

    return NextResponse.json({
      success: true,
      routes: optimizedRoutes,
      summary: {
        totalOrders: orders.length,
        optimizedOrders: ordersWithCoordinates.length,
        totalRoutes: optimizedRoutes.length,
        totalDistance: optimizedRoutes.reduce((sum, route) => sum + route.totalDistance, 0),
        totalTime: optimizedRoutes.reduce((sum, route) => sum + route.totalTime, 0),
        averageOrdersPerRoute: Math.round(ordersWithCoordinates.length / optimizedRoutes.length),
      },
      settings: settings,
    })
  } catch (error) {
    console.error("❌ Route optimization error:", error)
    return NextResponse.json(
      {
        error: "Failed to optimize routes",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function createOptimizedRoutes(
  orders: any[],
  warehouseLocation: [number, number],
  settings: any,
): Promise<OptimizedRoute[]> {
  const routes: OptimizedRoute[] = []
  const unassignedOrders = [...orders]
  let routeCounter = 1

  while (unassignedOrders.length > 0) {
    const route: OptimizedRoute = {
      id: `route-${routeCounter}`,
      name: `Route ${routeCounter}`,
      orders: [],
      totalDistance: 0,
      totalTime: 0,
      estimatedDuration: "",
      waypoints: [warehouseLocation],
    }

    let currentLocation = warehouseLocation
    let currentTime = parseTimeToMinutes(settings.workingHours.start)

    // Add orders to route using nearest neighbor algorithm with MyRouteOnline principles
    while (
      route.orders.length < settings.maxOrdersPerRoute &&
      unassignedOrders.length > 0 &&
      currentTime < parseTimeToMinutes(settings.workingHours.end)
    ) {
      let bestOrderIndex = -1
      let bestScore = Number.POSITIVE_INFINITY

      // Find the best next order based on optimization method
      for (let i = 0; i < unassignedOrders.length; i++) {
        const order = unassignedOrders[i]
        const distance = calculateDistance(currentLocation, order.coordinates)
        const travelTime = estimateTravelTime(distance)

        let score = 0

        switch (settings.optimizationMethod) {
          case "distance":
            score = distance
            break
          case "time":
            score = travelTime
            break
          case "hybrid":
            score = distance * 0.6 + travelTime * 0.4
            break
        }

        // Apply priority weighting
        if (settings.considerPriority) {
          const priorityMultiplier =
            {
              urgent: 0.5,
              high: 0.7,
              normal: 1.0,
              low: 1.3,
            }[order.priority] || 1.0
          score *= priorityMultiplier
        }

        if (score < bestScore) {
          bestScore = score
          bestOrderIndex = i
        }
      }

      if (bestOrderIndex === -1) break

      // Add the best order to the route
      const selectedOrder = unassignedOrders[bestOrderIndex]
      const distance = calculateDistance(currentLocation, selectedOrder.coordinates)
      const travelTime = estimateTravelTime(distance)

      // Estimate service time (5-15 minutes based on priority)
      const serviceTime =
        {
          urgent: 15,
          high: 12,
          normal: 10,
          low: 8,
        }[selectedOrder.priority] || 10

      currentTime += travelTime + serviceTime

      route.orders.push({
        id: selectedOrder.id,
        order_number: selectedOrder.order_number,
        customer_name: selectedOrder.customer_name,
        delivery_address: selectedOrder.delivery_address,
        coordinates: selectedOrder.coordinates,
        priority: selectedOrder.priority,
        estimatedArrival: formatMinutesToTime(currentTime - serviceTime),
        distanceFromPrevious: Math.round(distance * 100) / 100,
        timeFromPrevious: travelTime,
      })

      route.waypoints.push(selectedOrder.coordinates)
      route.totalDistance += distance
      route.totalTime += travelTime + serviceTime

      currentLocation = selectedOrder.coordinates
      unassignedOrders.splice(bestOrderIndex, 1)
    }

    // Add return to warehouse
    const returnDistance = calculateDistance(currentLocation, warehouseLocation)
    const returnTime = estimateTravelTime(returnDistance)
    route.totalDistance += returnDistance
    route.totalTime += returnTime
    route.waypoints.push(warehouseLocation)

    route.estimatedDuration = formatMinutesToDuration(route.totalTime)

    routes.push(route)
    routeCounter++

    // Safety check to prevent infinite loops
    if (routeCounter > 50) {
      console.warn("⚠️ Route optimization stopped at 50 routes to prevent infinite loop")
      break
    }
  }

  return routes
}

function calculateDistance(point1: [number, number], point2: [number, number]): number {
  const [lat1, lon1] = point1
  const [lat2, lon2] = point2

  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function estimateTravelTime(distanceKm: number): number {
  // Estimate travel time in minutes
  // Assume average speed of 30 km/h in urban areas
  const averageSpeedKmh = 30
  return Math.round((distanceKm / averageSpeedKmh) * 60)
}

function parseTimeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(":").map(Number)
  return hours * 60 + minutes
}

function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

function formatMinutesToDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}
