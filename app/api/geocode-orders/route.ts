import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { GeocodingService } from "@/lib/geocoding-service"

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "Order IDs are required" }, { status: 400 })
    }

    console.log(`Geocoding ${orderIds.length} orders`)

    // Fetch orders from database
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, delivery_address, latitude, longitude")
      .in("id", orderIds)

    if (fetchError) {
      console.error("Error fetching orders:", fetchError)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No orders found" }, { status: 404 })
    }

    const results = []
    let geocodedCount = 0

    for (const order of orders) {
      try {
        // Skip if already has coordinates
        if (order.latitude && order.longitude) {
          results.push({
            orderId: order.id,
            coordinates: [order.latitude, order.longitude],
            status: "already_geocoded",
          })
          continue
        }

        // Geocode the address
        const coordinates = await GeocodingService.geocodeAddress(order.delivery_address)

        if (coordinates) {
          // Update order with coordinates
          const { error: updateError } = await supabase
            .from("orders")
            .update({
              latitude: coordinates[0],
              longitude: coordinates[1],
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id)

          if (updateError) {
            console.error(`Error updating coordinates for order ${order.id}:`, updateError)
            results.push({
              orderId: order.id,
              coordinates: null,
              status: "update_failed",
              error: updateError.message,
            })
          } else {
            results.push({
              orderId: order.id,
              coordinates: coordinates,
              status: "geocoded",
            })
            geocodedCount++
          }
        } else {
          results.push({
            orderId: order.id,
            coordinates: null,
            status: "geocoding_failed",
          })
        }

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error)
        results.push({
          orderId: order.id,
          coordinates: null,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      success: true,
      results: results,
      geocoded: geocodedCount,
      total: orders.length,
      message: `Successfully geocoded ${geocodedCount} out of ${orders.length} orders`,
    })
  } catch (error) {
    console.error("Geocoding API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address) {
      return NextResponse.json({ error: "Address parameter is required" }, { status: 400 })
    }

    const coordinates = await GeocodingService.geocodeAddress(address)

    if (coordinates) {
      return NextResponse.json({
        success: true,
        coordinates: coordinates,
        address: address,
      })
    } else {
      return NextResponse.json({ error: "Failed to geocode address" }, { status: 404 })
    }
  } catch (error) {
    console.error("Geocoding API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
