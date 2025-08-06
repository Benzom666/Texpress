import { type NextRequest, NextResponse } from "next/server"
import { GraphHopperRouteOptimizer } from "@/lib/services/graphhopper/route-optimizer"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderIds, settings, vehicleCount = 1, adminId } = body

    // Validate required fields
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "Order IDs are required and must be a non-empty array" }, { status: 400 })
    }

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    if (!settings || !settings.warehouseLocation) {
      return NextResponse.json({ error: "Optimization settings with warehouse location are required" }, { status: 400 })
    }

    console.log(`🚛 Starting GraphHopper route optimization for ${orderIds.length} orders`)

    // Fetch orders from database
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .in("id", orderIds)
      .eq("created_by", adminId)

    if (ordersError) {
      console.error("❌ Error fetching orders:", ordersError)
      return NextResponse.json({ error: "Failed to fetch orders from database" }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No orders found for the provided IDs" }, { status: 404 })
    }

    // Check if orders have coordinates
    const ordersWithCoordinates = orders.filter(
      (order) => order.coordinates && Array.isArray(order.coordinates) && order.coordinates.length === 2,
    )

    if (ordersWithCoordinates.length === 0) {
      return NextResponse.json(
        { error: "No orders with valid coordinates found. Please geocode orders first." },
        { status: 400 },
      )
    }

    if (ordersWithCoordinates.length !== orders.length) {
      console.warn(`⚠️ ${orders.length - ordersWithCoordinates.length} orders skipped due to missing coordinates`)
    }

    // Initialize GraphHopper optimizer
    const optimizer = new GraphHopperRouteOptimizer(adminId)

    // Optimize routes
    const optimizedRoutes = await optimizer.optimizeRoutes(ordersWithCoordinates, settings, vehicleCount)

    console.log(`✅ Successfully optimized ${optimizedRoutes.length} routes`)

    // Return optimization results
    return NextResponse.json({
      success: true,
      message: `Successfully optimized ${optimizedRoutes.length} routes`,
      data: {
        routes: optimizedRoutes,
        totalOrders: ordersWithCoordinates.length,
        skippedOrders: orders.length - ordersWithCoordinates.length,
        optimizationSettings: settings,
      },
    })
  } catch (error) {
    console.error("❌ GraphHopper route optimization error:", error)

    // Handle specific GraphHopper API errors
    if (error instanceof Error) {
      if (error.message.includes("GraphHopper")) {
        return NextResponse.json(
          {
            error: "Route optimization service error",
            details: error.message,
            suggestion: "Please check your GraphHopper API key and try again",
          },
          { status: 503 },
        )
      }

      if (error.message.includes("coordinates")) {
        return NextResponse.json(
          {
            error: "Invalid coordinates",
            details: error.message,
            suggestion: "Please ensure all orders have valid geocoded coordinates",
          },
          { status: 400 },
        )
      }
    }

    return NextResponse.json(
      {
        error: "Route optimization failed",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("adminId")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    // Initialize optimizer to get routes with stats
    const optimizer = new GraphHopperRouteOptimizer(adminId)
    const routes = await optimizer.getRoutesWithStats(adminId)

    return NextResponse.json({
      success: true,
      data: {
        routes,
        totalRoutes: routes.length,
      },
    })
  } catch (error) {
    console.error("❌ Error fetching optimized routes:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch routes",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
