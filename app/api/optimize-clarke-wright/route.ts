import { NextRequest, NextResponse } from 'next/server'
import { clarkeWrightService } from '@/lib/services/clarke-wright-service'
import type { Customer, Vehicle, Depot } from '@/lib/algorithms/clarke-wright-savings'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { depot, customers, vehicles, options } = body

    // Validate required fields
    if (!depot || !customers || !vehicles) {
      return NextResponse.json(
        { error: 'Depot, customers, and vehicles are required' },
        { status: 400 }
      )
    }

    console.log(`🚛 Starting Clarke-Wright optimization for ${customers.length} customers with ${vehicles.length} vehicles`)

    // Run Clarke-Wright optimization
    const result = await clarkeWrightService.optimizeRoutes({
      depot: depot as Depot,
      customers: customers as Customer[],
      vehicles: vehicles as Vehicle[],
      options
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    console.log(`✅ Clarke-Wright optimization completed:`)
    console.log(`   - Routes: ${result.result?.routes.length}`)
    console.log(`   - Total Distance: ${result.result?.totalDistance.toFixed(2)} km`)
    console.log(`   - Processing Time: ${result.processingTime}ms`)
    console.log(`   - Savings Achieved: ${result.statistics?.savingsAchieved.toFixed(2)}%`)

    return NextResponse.json({
      success: true,
      data: {
        routes: result.result?.routes,
        totalDistance: result.result?.totalDistance,
        totalTime: result.result?.totalTime,
        unassignedCustomers: result.result?.unassignedCustomers,
        statistics: result.statistics,
        processingTime: result.processingTime,
        iterations: result.result?.iterations
      }
    })
  } catch (error) {
    console.error('❌ Clarke-Wright optimization error:', error)
    return NextResponse.json(
      {
        error: 'Optimization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const history = await clarkeWrightService.getOptimizationHistory(limit)

    return NextResponse.json({
      success: true,
      data: history
    })
  } catch (error) {
    console.error('❌ Error fetching optimization history:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch optimization history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
