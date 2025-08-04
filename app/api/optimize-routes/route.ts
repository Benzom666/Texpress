import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Mock optimization engine for demonstration
class MockRouteOptimizer {
  async optimizeRoutes(orders: any[], parameters: any = {}) {
    console.log(`🔧 Mock optimization for ${orders.length} orders with parameters:`, parameters)

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Create mock routes
    const routes = []
    const ordersPerRoute = Math.ceil(orders.length / (parameters.maxDrivers || 3))

    for (let i = 0; i < Math.min(parameters.maxDrivers || 3, orders.length); i++) {
      const routeOrders = orders.slice(i * ordersPerRoute, (i + 1) * ordersPerRoute)
      if (routeOrders.length === 0) break

      routes.push({
        route_number: i + 1,
        driver_id: null,
        orders: routeOrders.map((order, index) => ({
          ...order,
          stop_number: index + 1,
          estimated_arrival: new Date(Date.now() + (i * 60 + index * 15) * 60000).toISOString(),
          zone: `Zone ${String.fromCharCode(65 + i)}`,
        })),
        total_distance: Math.round((Math.random() * 50 + 20) * 100) / 100,
        total_duration: Math.round(routeOrders.length * 15 + Math.random() * 60),
        zone_coverage: [`Zone ${String.fromCharCode(65 + i)}`],
        optimization_score: Math.round((Math.random() * 20 + 80) * 100) / 100,
      })
    }

    return {
      routes,
      optimization_metrics: {
        total_routes: routes.length,
        total_stops: orders.length,
        total_distance: routes.reduce((sum, route) => sum + route.total_distance, 0),
        total_duration: routes.reduce((sum, route) => sum + route.total_duration, 0),
        average_stops_per_route: Math.round((orders.length / routes.length) * 100) / 100,
        optimization_score:
          Math.round((routes.reduce((sum, route) => sum + route.optimization_score, 0) / routes.length) * 100) / 100,
      },
      unassigned_orders: [],
      google_api_calls_used: Math.floor(Math.random() * 10) + 5,
      processing_time: 2.1,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orderIds, adminId, parameters } = await request.json()

    console.log("🚀 Starting route optimization:", {
      orderCount: orderIds?.length || 0,
      adminId,
      parameters,
    })

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: "No orders provided for optimization" }, { status: 400 })
    }

    if (!adminId) {
      return NextResponse.json({ success: false, error: "Admin ID is required" }, { status: 400 })
    }

    // Fetch orders from database
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        status,
        priority,
        created_at,
        updated_at
      `)
      .in("id", orderIds)

    if (ordersError) {
      console.error("❌ Error fetching orders:", ordersError)
      return NextResponse.json({ success: false, error: `Database error: ${ordersError.message}` }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: false, error: "No orders found for the provided IDs" }, { status: 404 })
    }

    console.log(`✅ Fetched ${orders.length} orders for optimization`)

    // Use mock optimizer for now
    const optimizer = new MockRouteOptimizer()
    const optimizationResult = await optimizer.optimizeRoutes(orders, parameters)

    console.log("✅ Optimization completed:", {
      routesCreated: optimizationResult.routes.length,
      totalStops: optimizationResult.optimization_metrics.total_stops,
      apiCallsUsed: optimizationResult.google_api_calls_used,
    })

    // Try to store optimization result in database (gracefully handle if table doesn't exist)
    try {
      const { data: savedOptimization, error: saveError } = await supabase
        .from("route_optimizations")
        .insert({
          admin_id: adminId,
          order_ids: orderIds,
          optimization_parameters: parameters || {},
          optimization_result: optimizationResult,
          optimization_type: "mock_optimization",
          api_calls_used: optimizationResult.google_api_calls_used,
          total_routes: optimizationResult.routes.length,
          total_orders: orders.length,
          total_distance: optimizationResult.optimization_metrics.total_distance,
          total_duration: optimizationResult.optimization_metrics.total_duration,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (saveError) {
        console.warn("⚠️ Failed to save optimization result:", saveError.message)
        // Continue anyway, don't fail the request
      } else {
        console.log("💾 Optimization result saved successfully")
      }
    } catch (saveError) {
      console.warn("⚠️ Could not save optimization result (table may not exist):", saveError)
    }

    return NextResponse.json({
      success: true,
      data: optimizationResult,
      api_calls_used: optimizationResult.google_api_calls_used,
    })
  } catch (error) {
    console.error("❌ Route optimization error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown optimization error",
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
      return NextResponse.json({ success: false, error: "Admin ID is required" }, { status: 400 })
    }

    // Try to fetch recent optimizations (gracefully handle if table doesn't exist)
    try {
      const { data: optimizations, error } = await supabase
        .from("route_optimizations")
        .select("*")
        .eq("admin_id", adminId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        console.warn("⚠️ Error fetching optimization history:", error.message)
        // Return empty array if table doesn't exist
        return NextResponse.json({
          success: true,
          data: [],
          message: "Optimization history table not found. Please run database migrations.",
        })
      }

      return NextResponse.json({
        success: true,
        data: optimizations || [],
      })
    } catch (error) {
      console.warn("⚠️ Could not fetch optimization history (table may not exist):", error)
      return NextResponse.json({
        success: true,
        data: [],
        message: "Optimization history not available. Please run database migrations.",
      })
    }
  } catch (error) {
    console.error("❌ Error fetching optimization history:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
