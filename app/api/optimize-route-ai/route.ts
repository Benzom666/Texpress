import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  coordinates?: [number, number]
  priority?: string
}

interface OptimizedStop {
  stopNumber: number
  stopLabel: string
  orderId: string
  coordinates: [number, number]
  estimatedTime: number
  distance: number
}

// Simple geocoding using OpenStreetMap Nominatim (free)
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`, {
      headers: {
        "User-Agent": "DeliveryApp/1.0",
      },
    })

    if (!response.ok) {
      console.error("Geocoding API error:", response.status)
      return null
    }

    const data = await response.json()
    if (data && data.length > 0) {
      const lat = Number.parseFloat(data[0].lat)
      const lon = Number.parseFloat(data[0].lon)
      return [lat, lon]
    }
    return null
  } catch (error) {
    console.error("Geocoding error:", error)
    return null
  }
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Simple nearest neighbor algorithm for route optimization
function optimizeRoute(orders: Order[]): OptimizedStop[] {
  if (orders.length === 0) return []
  if (orders.length === 1) {
    return [
      {
        stopNumber: 1,
        stopLabel: `${orders[0].customer_name} - ${orders[0].order_number}`,
        orderId: orders[0].id,
        coordinates: orders[0].coordinates!,
        estimatedTime: 15,
        distance: 0,
      },
    ]
  }

  const optimizedStops: OptimizedStop[] = []
  const remainingOrders = [...orders]

  // Start with the first order (could be improved by finding the best starting point)
  let currentOrder = remainingOrders.shift()!
  let stopNumber = 1

  optimizedStops.push({
    stopNumber,
    stopLabel: `${currentOrder.customer_name} - ${currentOrder.order_number}`,
    orderId: currentOrder.id,
    coordinates: currentOrder.coordinates!,
    estimatedTime: 15,
    distance: 0,
  })

  // Find nearest neighbor for each subsequent stop
  while (remainingOrders.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    const currentCoords = currentOrder.coordinates!

    for (let i = 0; i < remainingOrders.length; i++) {
      const orderCoords = remainingOrders[i].coordinates!
      const distance = calculateDistance(currentCoords[0], currentCoords[1], orderCoords[0], orderCoords[1])

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }

    currentOrder = remainingOrders.splice(nearestIndex, 1)[0]
    stopNumber++

    optimizedStops.push({
      stopNumber,
      stopLabel: `${currentOrder.customer_name} - ${currentOrder.order_number}`,
      orderId: currentOrder.id,
      coordinates: currentOrder.coordinates!,
      estimatedTime: 15,
      distance: nearestDistance,
    })
  }

  return optimizedStops
}

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "Order IDs are required" }, { status: 400 })
    }

    console.log("Optimizing route for orders:", orderIds)

    // Fetch orders from database
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, delivery_address, coordinates, priority")
      .in("id", orderIds)

    if (fetchError) {
      console.error("Error fetching orders:", fetchError)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No orders found" }, { status: 404 })
    }

    console.log("Fetched orders:", orders.length)

    // Geocode addresses that don't have coordinates
    const ordersWithCoords: Order[] = []

    for (const order of orders) {
      let coordinates = order.coordinates

      // Parse coordinates if they're stored as a string
      if (typeof coordinates === "string") {
        try {
          coordinates = JSON.parse(coordinates)
        } catch (e) {
          coordinates = null
        }
      }

      // Validate coordinates
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        if (order.delivery_address) {
          console.log(`Geocoding address: ${order.delivery_address}`)
          coordinates = await geocodeAddress(order.delivery_address)

          if (coordinates) {
            // Update the order in the database with the geocoded coordinates
            await supabase.from("orders").update({ coordinates }).eq("id", order.id)
          }
        }
      }

      if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
        ordersWithCoords.push({
          ...order,
          coordinates: coordinates as [number, number],
        })
      } else {
        console.warn(`Could not geocode order ${order.order_number}: ${order.delivery_address}`)
      }
    }

    if (ordersWithCoords.length === 0) {
      return NextResponse.json({ error: "No orders could be geocoded" }, { status: 400 })
    }

    console.log("Orders with coordinates:", ordersWithCoords.length)

    // Optimize the route
    const optimizedStops = optimizeRoute(ordersWithCoords)

    // Calculate total distance and time
    const totalDistance = optimizedStops.reduce((sum, stop) => sum + stop.distance, 0)
    const totalTime = optimizedStops.reduce((sum, stop) => sum + stop.estimatedTime, 0)

    console.log("Route optimization complete:", {
      stops: optimizedStops.length,
      totalDistance,
      totalTime,
    })

    return NextResponse.json({
      success: true,
      route: {
        stops: optimizedStops,
        totalDistance,
        totalTime,
        optimizedBy: "Nearest Neighbor Algorithm",
      },
    })
  } catch (error) {
    console.error("Route optimization error:", error)
    return NextResponse.json({ error: "Internal server error during route optimization" }, { status: 500 })
  }
}
