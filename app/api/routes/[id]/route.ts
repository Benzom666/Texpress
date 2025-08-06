import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const routeId = params.id

    const { data: route, error } = await supabase
      .from("routes")
      .select(`
        *,
        user_profiles!routes_driver_id_fkey(first_name, last_name, email),
        route_stops(
          *,
          orders(id, order_number, customer_name, delivery_address, coordinates)
        )
      `)
      .eq("id", routeId)
      .single()

    if (error) {
      console.error("Error fetching route:", error)
      return NextResponse.json({ error: "Route not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      route,
    })
  } catch (error) {
    console.error("Error in route detail API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const routeId = params.id

    // First, remove route_id from orders
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        route_id: null,
        route_number: null,
        stop_number: null,
      })
      .eq("route_id", routeId)

    if (updateError) {
      console.error("Error updating orders:", updateError)
    }

    // Delete the route (cascade will handle route_stops)
    const { error: deleteError } = await supabase.from("routes").delete().eq("id", routeId)

    if (deleteError) {
      console.error("Error deleting route:", deleteError)
      return NextResponse.json({ error: "Failed to delete route" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Route deleted successfully",
    })
  } catch (error) {
    console.error("Error in route delete API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
