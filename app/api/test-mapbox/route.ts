import { NextResponse } from "next/server"

export async function GET() {
  try {
    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapbox access token not found",
          details: "Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN environment variable",
        },
        { status: 500 },
      )
    }

    // Test with a simple geocoding request
    const testUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/toronto.json?access_token=${accessToken}&limit=1`

    const response = await fetch(testUrl)

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        {
          success: false,
          error: `Mapbox API test failed: ${response.status}`,
          details: errorText,
        },
        { status: response.status },
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: "Mapbox API is working correctly",
      testResult: {
        status: response.status,
        features: data.features?.length || 0,
      },
    })
  } catch (error) {
    console.error("Mapbox test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test Mapbox API",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
