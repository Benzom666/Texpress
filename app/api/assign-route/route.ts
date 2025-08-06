import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { routeId, driverId } = await request.json()

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

    // Check if driver is available
    if (driver.availability_status === 'unavailable') {
      return NextResponse.json(
        { error: 'Driver is currently unavailable' },
        { status: 400 }
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

    // Check if route is in a state that allows driver assignment
    if (route.status === 'completed' || route.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot assign driver to completed or cancelled route' },
        { status: 400 }
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
        { error: 'Failed to assign driver to route' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Driver ${driver.first_name} ${driver.last_name} assigned to route ${route.route_number}`,
      route: updatedRoute,
      driver: driver
    })

  } catch (error) {
    console.error('Error in assign-route API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
