import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const available = searchParams.get('available')
    
    let query = supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email,
        role,
        is_available,
        phone_number,
        created_at,
        updated_at
      `)
      .eq('role', 'driver')

    if (available === 'true') {
      query = query.eq('is_available', true)
    }

    const { data: drivers, error } = await query
      .order('name', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 })
    }

    return NextResponse.json({ drivers: drivers || [] })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()

    const { data: driver, error } = await supabase
      .from('user_profiles')
      .insert([{ ...body, role: 'driver' }])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create driver' }, { status: 500 })
    }

    return NextResponse.json({ driver })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
