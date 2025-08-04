import { type NextRequest, NextResponse } from "next/server"

interface OptimizationWaypoint {
  coordinates: [number, number] // [lat, lng]
  name?: string
  address?: string
}

interface RouteOptimizationRequest {
  waypoints: OptimizationWaypoint[]
  options?: {
    profile?: "driving" | "walking" | "cycling"
    source?: "first" | "any"
    destination?: "last" | "any"
    roundtrip?: boolean
    annotations?: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteOptimizationRequest = await request.json()
    const { waypoints, options = {} } = body

    // Validate input
    if (!waypoints || waypoints.length < 2) {
      return NextResponse.json({ error: "At least 2 waypoints are required" }, { status: 400 })
    }

    if (waypoints.length > 12) {
      return NextResponse.json({ error: "Maximum 12 waypoints allowed" }, { status: 400 })
    }

    // Get Mapbox access token
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: "Mapbox access token not configured" }, { status: 500 })
    }

    // Validate coordinates
    const validWaypoints = waypoints.filter((wp) => {
      const [lat, lng] = wp.coordinates
      return !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    })

    if (validWaypoints.length < 2) {
      return NextResponse.json({ error: "Not enough valid waypoints" }, { status: 400 })
    }

    // Format coordinates for Mapbox API (lng,lat format)
    const coordinates = validWaypoints.map((wp) => `${wp.coordinates[1]},${wp.coordinates[0]}`).join(";")

    // Build Mapbox Optimization API URL
    const profile = options.profile || "driving"
    const source = options.source || "first"
    const destination = options.destination || "last"
    const roundtrip = options.roundtrip || false

    const url = new URL(`https://api.mapbox.com/optimized-trips/v1/mapbox/${profile}/${coordinates}`)

    url.searchParams.set("access_token", accessToken)
    url.searchParams.set("overview", "full")
    url.searchParams.set("steps", "true")
    url.searchParams.set("geometries", "geojson")
    url.searchParams.set("source", source)
    url.searchParams.set("destination", destination)
    url.searchParams.set("roundtrip", roundtrip.toString())

    if (options.annotations) {
      url.searchParams.set("annotations", options.annotations.join(","))
    }

    console.log(`🚀 Calling Mapbox Optimization API for ${validWaypoints.length} waypoints`)

    // Call Mapbox API
    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Mapbox API error:", response.status, errorText)
      return NextResponse.json({ error: `Mapbox API error: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()

    if (data.code !== "Ok") {
      console.error("Optimization failed:", data.code, data.message)
      return NextResponse.json({ error: `Optimization failed: ${data.code}` }, { status: 400 })
    }

    if (!data.trips || data.trips.length === 0) {
      return NextResponse.json({ error: "No optimized trips returned" }, { status: 400 })
    }

    const trip = data.trips[0]

    // Process the optimized route
    const optimizedWaypoints = data.waypoints.map((wp: any, index: number) => {
      const originalWaypoint = waypoints[wp.waypoint_index]
      return {
        coordinates: [wp.location[1], wp.location[0]] as [number, number], // Convert back to [lat, lng]
        name: originalWaypoint.name || `Stop ${index + 1}`,
        address: originalWaypoint.address,
        waypointIndex: wp.waypoint_index,
      }
    })

    // Convert geometry coordinates from [lng, lat] to [lat, lng]
    const geometry = trip.geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]] as [number, number],
    )

    const result = {
      waypoints: optimizedWaypoints,
      distance: trip.distance, // meters
      duration: trip.duration, // seconds
      geometry,
      legs: trip.legs.map((leg: any) => ({
        distance: leg.distance,
        duration: leg.duration,
        steps:
          leg.steps?.map((step: any) => ({
            distance: step.distance,
            duration: step.duration,
            instruction: step.maneuver?.instruction || "",
            coordinates:
              step.geometry?.coordinates?.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]) ||
              [],
          })) || [],
      })),
    }

    console.log(
      `✅ Route optimization successful: ${(result.distance / 1000).toFixed(1)}km, ${Math.round(result.duration / 60)}min`,
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Route optimization error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
