import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { googleMapsDirectService } from "@/lib/google-maps-direct-coordinates"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { orderIds, adminId, parameters } = await request.json()

    console.log("🚀 Starting direct coordinate route optimization:", {
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

    // Validate warehouse coordinates
    const warehouseCoordinates = parameters?.warehouseCoordinates
    if (!warehouseCoordinates || !Array.isArray(warehouseCoordinates) || warehouseCoordinates.length !== 2) {
      return NextResponse.json(
        { success: false, error: "Valid warehouse coordinates [lat, lng] are required" },
        { status: 400 },
      )
    }

    const [warehouseLat, warehouseLng] = warehouseCoordinates
    if (
      typeof warehouseLat !== "number" ||
      typeof warehouseLng !== "number" ||
      isNaN(warehouseLat) ||
      isNaN(warehouseLng)
    ) {
      return NextResponse.json(
        { success: false, error: "Warehouse coordinates must be valid numbers" },
        { status: 400 },
      )
    }

    // Fetch orders with coordinates from database
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
        updated_at,
        coordinates,
        zone,
        postal_code
      `)
      .in("id", orderIds)

    if (ordersError) {
      console.error("❌ Error fetching orders:", ordersError)
      return NextResponse.json({ success: false, error: `Database error: ${ordersError.message}` }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: false, error: "No orders found for the provided IDs" }, { status: 404 })
    }

    // Validate that orders have coordinates
    const ordersWithCoordinates = orders.filter((order) => {
      if (!order.coordinates || !Array.isArray(order.coordinates) || order.coordinates.length !== 2) {
        console.warn(`⚠️ Order ${order.id} missing valid coordinates:`, order.coordinates)
        return false
      }

      const [lat, lng] = order.coordinates
      if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
        console.warn(`⚠️ Order ${order.id} has invalid coordinate values:`, order.coordinates)
        return false
      }

      return true
    })

    if (ordersWithCoordinates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No orders have valid coordinates. Please ensure orders have [latitude, longitude] coordinates.",
        },
        { status: 400 },
      )
    }

    console.log(`✅ Found ${ordersWithCoordinates.length} orders with valid coordinates`)

    // Prepare optimization parameters with direct coordinates
    const optimizationParameters = {
      maxDrivers: parameters?.maxDrivers || 3,
      maxStopsPerRoute: parameters?.maxStopsPerRoute || 10,
      optimizationCriteria: parameters?.optimizationCriteria || "balanced",
      considerTraffic: parameters?.considerTraffic || false,
      workingHours: parameters?.workingHours || { start: "08:00", end: "18:00" },
      warehouseCoordinates: [warehouseLat, warehouseLng] as [number, number],
      travelMode: parameters?.travelMode || "DRIVING",
      avoidTolls: parameters?.avoidTolls || false,
      avoidHighways: parameters?.avoidHighways || false,
    }

    // Run optimization using direct coordinates
    const optimizationResult = await googleMapsDirectService.optimizeRoutesWithDirectCoordinates(
      ordersWithCoordinates,
      optimizationParameters,
    )

    console.log("✅ Direct coordinate optimization completed:", {
      routesCreated: optimizationResult.routes.length,
      totalStops: optimizationResult.routes.reduce((sum, route) => sum + route.orders.length, 0),
      unassignedOrders: optimizationResult.unassigned_orders.length,
    })

    // Try to store optimization result in database
    try {
      const { data: savedOptimization, error: saveError } = await supabase
        .from("route_optimizations")
        .insert({
          admin_id: adminId,
          order_ids: orderIds,
          optimization_parameters: optimizationParameters,
          optimization_result: optimizationResult,
          optimization_type: "direct_coordinates",
          api_calls_used: 0, // No API calls needed for direct coordinates
          total_routes: optimizationResult.routes.length,
          total_orders: ordersWithCoordinates.length,
          total_distance: optimizationResult.total_distance,
          total_duration: optimizationResult.total_duration,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (saveError) {
        console.warn("⚠️ Failed to save optimization result:", saveError.message)
      } else {
        console.log("💾 Direct coordinate optimization result saved successfully")
      }
    } catch (saveError) {
      console.warn("⚠️ Could not save optimization result:", saveError)
    }

    return NextResponse.json({
      success: true,
      data: optimizationResult,
      coordinates_used: ordersWithCoordinates.length,
      coordinates_invalid: orders.length - ordersWithCoordinates.length,
      warehouse_coordinates: optimizationParameters.warehouseCoordinates,
    })
  } catch (error) {
    console.error("❌ Direct coordinate route optimization error:", error)
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

    // Fetch recent direct coordinate optimizations
    try {
      const { data: optimizations, error } = await supabase
        .from("route_optimizations")
        .select("*")
        .eq("admin_id", adminId)
        .eq("optimization_type", "direct_coordinates")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        console.warn("⚠️ Error fetching direct coordinate optimization history:", error.message)
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
      console.warn("⚠️ Could not fetch direct coordinate optimization history:", error)
      return NextResponse.json({
        success: true,
        data: [],
        message: "Optimization history not available. Please run database migrations.",
      })
    }
  } catch (error) {
    console.error("❌ Error fetching direct coordinate optimization history:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
