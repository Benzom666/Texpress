import { type NextRequest, NextResponse } from "next/server"
import { GraphHopperRouteOptimizer } from "@/lib/services/graphhopper/route-optimizer"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { routeId, newSettings, adminId, reason = "Manual re-optimization" } = body

    if (!routeId || !adminId) {
      return NextResponse.json({ error: "Route ID and admin ID are required" }, { status: 400 })
    }

    console.log(`🔄 Re-optimizing route ${routeId}`)

    // Initialize GraphHopper optimizer
    const optimizer = new GraphHopperRouteOptimizer(adminId)

    // Re-optimize the route
    const reoptimizedRoute = await optimizer.reoptimizeRoute(routeId, newSettings || {}, reason)

    console.log(`✅ Route ${routeId} re-optimized successfully`)

    return NextResponse.json({
      success: true,
      message: "Route re-optimized successfully",
      data: {
        route: reoptimizedRoute,
        improvement: {
          distanceReduction: reoptimizedRoute.optimizationMetrics.improvement,
          processingTime: reoptimizedRoute.optimizationMetrics.processingTime,
        },
      },
    })
  } catch (error) {
    console.error("❌ Route re-optimization error:", error)

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("Route not found")) {
        return NextResponse.json({ error: "Route not found" }, { status: 404 })
      }

      if (error.message.includes("No pending stops")) {
        return NextResponse.json({ error: "No pending stops to re-optimize" }, { status: 400 })
      }

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
    }

    return NextResponse.json(
      {
        error: "Route re-optimization failed",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
