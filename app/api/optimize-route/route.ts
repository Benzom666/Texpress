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
    console.log("🚀 Route optimization API called")

    const body: RouteOptimizationRequest = await request.json()
    const { waypoints, options = {} } = body

    console.log(`📍 Received ${waypoints?.length || 0} waypoints`)
    console.log("📋 Request body:", JSON.stringify(body, null, 2))

    // Validate input
    if (!waypoints || waypoints.length < 2) {
      console.error("❌ Invalid waypoints:", waypoints)
      return NextResponse.json(
        {
          success: false,
          error: "At least 2 waypoints are required",
        },
        { status: 400 },
      )
    }

    if (waypoints.length > 12) {
      console.error("❌ Too many waypoints:", waypoints.length)
      return NextResponse.json(
        {
          success: false,
          error: "Maximum 12 waypoints allowed",
        },
        { status: 400 },
      )
    }

    // Get Mapbox access token
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!accessToken) {
      console.error("❌ No Mapbox access token found")
      return NextResponse.json(
        {
          success: false,
          error: "Mapbox access token not configured",
        },
        { status: 500 },
      )
    }

    console.log("✅ Mapbox access token found")

    // Validate coordinates
    const validWaypoints = waypoints.filter((wp) => {
      if (!wp || !wp.coordinates || wp.coordinates.length !== 2) {
        console.warn("⚠️ Invalid waypoint structure:", wp)
        return false
      }

      const [lat, lng] = wp.coordinates
      const isValid = !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

      if (!isValid) {
        console.warn("⚠️ Invalid coordinates:", [lat, lng])
      }

      return isValid
    })

    console.log(`✅ Valid waypoints: ${validWaypoints.length}/${waypoints.length}`)

    if (validWaypoints.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Not enough valid waypoints after validation",
        },
        { status: 400 },
      )
    }

    // Format coordinates for Mapbox API (lng,lat format)
    const coordinates = validWaypoints.map((wp) => `${wp.coordinates[1]},${wp.coordinates[0]}`).join(";")
    console.log("📍 Formatted coordinates:", coordinates)

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

    console.log(`📡 Calling Mapbox API: ${url.toString()}`)

    // Call Mapbox API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    let response: Response
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "DeliveryOS/1.0",
        },
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("❌ Mapbox API timeout")
        return NextResponse.json(
          {
            success: false,
            error: "Request timeout - Mapbox API took too long to respond",
          },
          { status: 408 },
        )
      }
      throw fetchError
    }

    clearTimeout(timeoutId)

    console.log(`📥 Mapbox API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Mapbox API error:", response.status, errorText)

      let errorMessage = `Mapbox API error: ${response.status}`
      if (response.status === 401) {
        errorMessage = "Invalid Mapbox access token"
      } else if (response.status === 422) {
        errorMessage = "Invalid coordinates or route parameters"
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded - please try again later"
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: errorText,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("📊 Mapbox API response:", JSON.stringify(data, null, 2))

    if (data.code !== "Ok") {
      console.error("❌ Optimization failed:", data.code, data.message)
      return NextResponse.json(
        {
          success: false,
          error: `Optimization failed: ${data.code}`,
          details: data.message || "Unknown optimization error",
        },
        { status: 400 },
      )
    }

    if (!data.trips || data.trips.length === 0) {
      console.error("❌ No trips returned")
      return NextResponse.json(
        {
          success: false,
          error: "No optimized trips returned from Mapbox",
        },
        { status: 400 },
      )
    }

    const trip = data.trips[0]
    console.log(`✅ Trip found - Distance: ${trip.distance}m, Duration: ${trip.duration}s`)

    // Process the optimized route
    const optimizedWaypoints = data.waypoints.map((wp: any, index: number) => {
      const originalWaypoint = validWaypoints[wp.waypoint_index] || validWaypoints[0]
      return {
        coordinates: [wp.location[1], wp.location[0]] as [number, number], // Convert back to [lat, lng]
        name: originalWaypoint.name || `Stop ${index + 1}`,
        address: originalWaypoint.address,
        waypointIndex: wp.waypoint_index,
      }
    })

    // Convert geometry coordinates from [lng, lat] to [lat, lng]
    const geometry =
      trip.geometry?.coordinates?.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]) || []

    const result = {
      waypoints: optimizedWaypoints,
      distance: trip.distance || 0, // meters
      duration: trip.duration || 0, // seconds
      geometry,
      legs:
        trip.legs?.map((leg: any) => ({
          distance: leg.distance || 0,
          duration: leg.duration || 0,
          steps:
            leg.steps?.map((step: any) => ({
              distance: step.distance || 0,
              duration: step.duration || 0,
              instruction: step.maneuver?.instruction || "",
              coordinates:
                step.geometry?.coordinates?.map(
                  (coord: [number, number]) => [coord[1], coord[0]] as [number, number],
                ) || [],
            })) || [],
        })) || [],
    }

    console.log(
      `✅ Route optimization successful: ${(result.distance / 1000).toFixed(1)}km, ${Math.round(result.duration / 60)}min`,
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("❌ Route optimization error:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown server error"

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: errorMessage,
      },
      { status: 500 },
    )
  }
}
