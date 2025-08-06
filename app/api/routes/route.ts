import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { data: routes, error } = await supabase
      .from('routes')
      .select(`
        *,
        route_stops (
          id,
          stop_number,
          sequence_order,
          stop_label,
          address,
          status,
          orders (
            id,
            order_number,
            customer_name,
            delivery_address,
            status
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching routes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch routes' },
        { status: 500 }
      )
    }

    return NextResponse.json({ routes })
  } catch (error) {
    console.error('Error in routes GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, routeId, driverId } = body

    if (action === 'assign_driver') {
      if (!routeId || !driverId) {
        return NextResponse.json(
          { error: 'Route ID and Driver ID are required' },
          { status: 400 }
        )
      }

      // Verify the driver exists and is available
      const { data: driver, error: driverError } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, availability_status')
        .eq('id', driverId)
        .eq('role', 'driver')
        .single()

      if (driverError || !driver) {
        return NextResponse.json(
          { error: 'Driver not found or invalid' },
          { status: 404 }
        )
      }

      // Verify the route exists
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('id, route_number, status')
        .eq('id', routeId)
        .single()

      if (routeError || !route) {
        return NextResponse.json(
          { error: 'Route not found' },
          { status: 404 }
        )
      }

      // Update the route with the assigned driver
      const { data: updatedRoute, error: updateError } = await supabase
        .from('routes')
        .update({ 
          driver_id: driverId,
          status: 'planned',
          updated_at: new Date().toISOString()
        })
        .eq('id', routeId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating route:', updateError)
        return NextResponse.json(
          { error: `Database error: ${updateError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `Driver ${driver.first_name} ${driver.last_name} assigned to route ${route.route_number}`,
        route: updatedRoute,
        driver: driver
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in routes POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { routeId } = await request.json()

    if (!routeId) {
      return NextResponse.json(
        { error: 'Route ID is required' },
        { status: 400 }
      )
    }

    // First delete route stops
    const { error: stopsError } = await supabase
      .from('route_stops')
      .delete()
      .eq('route_id', routeId)

    if (stopsError) {
      console.error('Error deleting route stops:', stopsError)
      return NextResponse.json(
        { error: 'Failed to delete route stops' },
        { status: 500 }
      )
    }

    // Then delete the route
    const { error: routeError } = await supabase
      .from('routes')
      .delete()
      .eq('id', routeId)

    if (routeError) {
      console.error('Error deleting route:', routeError)
      return NextResponse.json(
        { error: 'Failed to delete route' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Route deleted successfully'
    })

  } catch (error) {
    console.error('Error in routes DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
