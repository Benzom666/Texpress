import { type NextRequest, NextResponse } from "next/server"
import { RouteManager } from "@/lib/route-manager"

export async function POST(request: NextRequest) {
  try {
    const { orders, routeName, createdBy, settings } = await request.json()

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: "Orders array is required" }, { status: 400 })
    }

    console.log(`Creating optimized route with ${orders.length} orders`)

    // Create the route using RouteManager
    const route = await RouteManager.createRoute(orders, undefined, routeName, createdBy)

    if (!route) {
      return NextResponse.json({ error: "Failed to create route" }, { status: 500 })
    }

    console.log(`Route created successfully: ${route.route_number}`)

    // Return the route in the expected format
    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        routeId: route.id,
        routeNumber: route.route_number,
        routeName: route.route_name,
        totalStops: route.total_stops,
        status: route.status,
        createdAt: route.created_at,
      },
    })
  } catch (error) {
    console.error("Error creating optimized route:", error)
    return NextResponse.json(
      {
        error: "Failed to create optimized route",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
