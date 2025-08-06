import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'
import { RouteManager } from '@/lib/route-manager'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { orderIds, driverId, optimizationType = 'distance' } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Order IDs are required' }, { status: 400 })
    }

    // Validate order IDs exist
    const validOrderIds = await RouteManager.validateOrderIds(orderIds)
    if (validOrderIds.length === 0) {
      return NextResponse.json({ error: 'No valid orders found' }, { status: 400 })
    }

    // Fetch order details
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .in('id', validOrderIds)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No orders found' }, { status: 404 })
    }

    // Simple optimization algorithm - sort by priority and then by distance
    const depot = [43.6532, -79.3832] // Toronto coordinates
    
    const optimizedOrders = orders
      .map(order => ({
        ...order,
        distance: calculateDistance(depot, order.coordinates || depot),
        priorityWeight: getPriorityWeight(order.priority)
      }))
      .sort((a, b) => {
        // First sort by priority
        if (a.priorityWeight !== b.priorityWeight) {
          return b.priorityWeight - a.priorityWeight
        }
        // Then by distance
        return a.distance - b.distance
      })

    // Create optimized stops
    const stops = optimizedOrders.map((order, index) => ({
      stopNumber: index + 1,
      stopLabel: `S${String(index + 1).padStart(2, '0')}`,
      orderId: order.id,
      coordinates: order.coordinates || depot,
      estimatedTime: 15, // 15 minutes per stop
      distance: index === 0 ? 0 : calculateDistance(
        optimizedOrders[index - 1].coordinates || depot,
        order.coordinates || depot
      )
    }))

    const totalDistance = stops.reduce((sum, stop) => sum + stop.distance, 0)
    const totalTime = stops.length * 15 // 15 minutes per stop

    // If driver is specified, create the route
    if (driverId) {
      try {
        const routeId = await RouteManager.createRoute({
          routeName: `Optimized Route ${new Date().toLocaleDateString()}`,
          stops,
          totalDistance,
          totalTime,
          createdBy: driverId,
          driverId
        })

        return NextResponse.json({
          success: true,
          routeId,
          stops,
          totalDistance: Math.round(totalDistance * 100) / 100,
          totalTime,
          optimizationType
        })
      } catch (error) {
        console.error('Error creating route:', error)
        return NextResponse.json({ error: 'Failed to create optimized route' }, { status: 500 })
      }
    }

    // Return optimization results without creating route
    return NextResponse.json({
      success: true,
      stops,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime,
      optimizationType
    })

  } catch (error) {
    console.error('Optimization error:', error)
    return NextResponse.json({ error: 'Failed to optimize route' }, { status: 500 })
  }
}

function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (coord2[0] - coord1[0]) * Math.PI / 180
  const dLon = (coord2[1] - coord1[1]) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function getPriorityWeight(priority: string): number {
  switch (priority?.toLowerCase()) {
    case 'urgent': return 4
    case 'high': return 3
    case 'normal': return 2
    case 'low': return 1
    default: return 2
  }
}
