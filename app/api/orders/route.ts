import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const driverId = searchParams.get("driverId")
    const routeId = searchParams.get("routeId")
    const createdBy = searchParams.get("createdBy")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    let query = supabase
      .from("orders")
      .select(`
        *,
        assigned_driver:user_profiles!orders_assigned_driver_id_fkey(
          id,
          full_name,
          email
        ),
        route:routes(
          id,
          route_number,
          route_name,
          status
        )
      `)
      .order("created_at", { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq("status", status)
    }

    if (driverId) {
      query = query.eq("assigned_driver_id", driverId)
    }

    if (routeId) {
      query = query.eq("route_id", routeId)
    }

    if (createdBy) {
      query = query.eq("created_by", createdBy)
    }

    // Apply pagination
    if (limit) {
      const limitNum = Number.parseInt(limit, 10)
      const offsetNum = offset ? Number.parseInt(offset, 10) : 0
      query = query.range(offsetNum, offsetNum + limitNum - 1)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error("Error fetching orders:", error)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    // Format the orders data
    const formattedOrders = (orders || []).map((order: any) => ({
      ...order,
      coordinates: order.latitude && order.longitude ? [order.latitude, order.longitude] : null,
      driver_name: order.assigned_driver ? order.assigned_driver.full_name || order.assigned_driver.email : undefined,
    }))

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      count: formattedOrders.length,
    })
  } catch (error) {
    console.error("Orders API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json()

    // Validate required fields
    const requiredFields = ["order_number", "customer_name", "delivery_address"]
    for (const field of requiredFields) {
      if (!orderData[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    // Get current user from auth header or session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Prepare order data
    const newOrder = {
      order_number: orderData.order_number,
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone || null,
      customer_email: orderData.customer_email || null,
      delivery_address: orderData.delivery_address,
      delivery_instructions: orderData.delivery_instructions || null,
      priority: orderData.priority || "normal",
      status: orderData.status || "pending",
      created_by: orderData.created_by || user.id,
      estimated_delivery_date: orderData.estimated_delivery_date || null,
      package_weight: orderData.package_weight || null,
      package_dimensions: orderData.package_dimensions || null,
      special_requirements: orderData.special_requirements || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Insert order into database
    const { data: order, error } = await supabase.from("orders").insert(newOrder).select().single()

    if (error) {
      console.error("Error creating order:", error)
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        order: {
          ...order,
          coordinates: order.latitude && order.longitude ? [order.latitude, order.longitude] : null,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Create order API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("id")

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const updateData = await request.json()

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString()

    // Update order in database
    const { data: order, error } = await supabase.from("orders").update(updateData).eq("id", orderId).select().single()

    if (error) {
      console.error("Error updating order:", error)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        coordinates: order.latitude && order.longitude ? [order.latitude, order.longitude] : null,
      },
    })
  } catch (error) {
    console.error("Update order API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("id")

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    // Delete order from database
    const { error } = await supabase.from("orders").delete().eq("id", orderId)

    if (error) {
      console.error("Error deleting order:", error)
      return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Order deleted successfully",
    })
  } catch (error) {
    console.error("Delete order API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
