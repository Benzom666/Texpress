import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: driver, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        user_id,
        first_name,
        last_name,
        email,
        phone,
        role,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .eq('role', 'driver')
      .single()

    if (error) {
      console.error('Error fetching driver:', error)
      return NextResponse.json(
        { error: 'Failed to fetch driver', details: error.message },
        { status: 500 }
      )
    }

    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      )
    }

    // Transform the data to match our Driver interface
    const transformedDriver = {
      ...driver,
      availability_status: 'available' as const,
      is_active: true,
      license_number: null,
      vehicle_type: null,
      vehicle_plate: null,
      current_location: null
    }

    return NextResponse.json({
      success: true,
      data: transformedDriver
    })
  } catch (error) {
    console.error('Get driver API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      phone,
      availability_status,
      is_active
    } = body

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (first_name) updateData.first_name = first_name
    if (last_name) updateData.last_name = last_name
    if (email) updateData.email = email
    if (phone !== undefined) updateData.phone = phone

    const { data: driver, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', id)
      .eq('role', 'driver')
      .select()
      .single()

    if (error) {
      console.error('Error updating driver:', error)
      return NextResponse.json(
        { error: 'Failed to update driver', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...driver,
        availability_status: availability_status || 'available',
        is_active: is_active !== undefined ? is_active : true,
        license_number: null,
        vehicle_type: null,
        vehicle_plate: null,
        current_location: null
      }
    })
  } catch (error) {
    console.error('Update driver API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', id)
      .eq('role', 'driver')

    if (error) {
      console.error('Error deleting driver:', error)
      return NextResponse.json(
        { error: 'Failed to delete driver', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Driver deleted successfully'
    })
  } catch (error) {
    console.error('Delete driver API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
