'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapboxMap } from '@/components/mapbox-map'
import { MapPin, Navigation, Clock, Route } from 'lucide-react'

interface MobileMapWidgetProps {
  orders?: any[]
  routes?: any[]
  currentLocation?: [number, number]
  className?: string
}

export function MobileMapWidget({ 
  orders = [], 
  routes = [], 
  currentLocation,
  className = ''
}: MobileMapWidgetProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>(currentLocation || [-74.006, 40.7128])
  const [isLocationEnabled, setIsLocationEnabled] = useState(false)

  useEffect(() => {
    // Try to get user's current location
    if (navigator.geolocation && !currentLocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setMapCenter([longitude, latitude])
          setIsLocationEnabled(true)
        },
        (error) => {
          console.warn('Geolocation error:', error)
          setIsLocationEnabled(false)
        }
      )
    }
  }, [currentLocation])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'assigned': return 'bg-blue-100 text-blue-800'
      case 'in_transit': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleOrderSelect = (order: any) => {
    setSelectedOrder(order)
    if (order.coordinates && order.coordinates.length === 2) {
      setMapCenter(order.coordinates)
    }
  }

  const handleCenterOnLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setMapCenter([longitude, latitude])
          setIsLocationEnabled(true)
        },
        (error) => {
          console.warn('Geolocation error:', error)
        }
      )
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Map Container */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Delivery Map
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCenterOnLocation}
                className="flex items-center gap-1"
              >
                <Navigation className="h-4 w-4" />
                My Location
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <MapboxMap
            orders={orders}
            routes={routes}
            center={mapCenter}
            zoom={13}
            height="300px"
            className="rounded-b-lg"
          />
        </CardContent>
      </Card>

      {/* Orders List */}
      {orders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Route className="h-5 w-5" />
              Active Orders ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedOrder?.id === order.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleOrderSelect(order)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{order.order_number}</h4>
                    <p className="text-xs text-gray-600">{order.customer_name}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                      {order.status}
                    </Badge>
                    {order.priority && (
                      <Badge className={`text-xs ${getPriorityColor(order.priority)}`}>
                        {order.priority}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{order.delivery_address}</span>
                  </div>
                  {order.estimated_delivery_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>ETA: {new Date(order.estimated_delivery_time).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>

                {order.assigned_driver && (
                  <div className="text-xs text-gray-500">
                    Driver: {order.assigned_driver.first_name} {order.assigned_driver.last_name}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Routes Summary */}
      {routes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Route className="h-5 w-5" />
              Active Routes ({routes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {routes.map((route) => (
              <div
                key={route.id}
                className="p-3 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">{route.route_name}</h4>
                  <Badge className={`text-xs ${getStatusColor(route.status)}`}>
                    {route.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Stops: {route.total_stops || 0}</div>
                  <div>Distance: {route.total_distance ? `${route.total_distance}km` : 'N/A'}</div>
                </div>

                {route.driver && (
                  <div className="text-xs text-gray-500 mt-1">
                    Driver: {route.driver.first_name} {route.driver.last_name}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {orders.length === 0 && routes.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Deliveries</h3>
            <p className="text-gray-600">Orders and routes will appear here when available.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default MobileMapWidget
