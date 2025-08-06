'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, MapPin, Clock, Truck, AlertTriangle, CheckCircle } from 'lucide-react'
import { useOrders, useDrivers, useRoutes } from '@/hooks/useApi'

export default function DispatchPage() {
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const { data: orders, loading: ordersLoading, refetch: refetchOrders } = useOrders()
  const { data: drivers, loading: driversLoading, refetch: refetchDrivers } = useDrivers()
  const { data: routes, loading: routesLoading, refetch: refetchRoutes } = useRoutes()

  const handleRefreshAll = async () => {
    await Promise.all([refetchOrders(), refetchDrivers(), refetchRoutes()])
    setLastUpdate(new Date())
  }

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefreshAll()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const activeOrders = orders?.filter(order => 
    order.status === 'assigned' || order.status === 'in_transit'
  ) || []

  const urgentOrders = orders?.filter(order => 
    order.priority === 'urgent' && order.status === 'pending'
  ) || []

  const availableDrivers = drivers?.filter(driver => 
    driver.availability_status === 'available'
  ) || []

  const activeRoutes = routes?.filter(route => 
    route.status === 'in_progress'
  ) || []

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      assigned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      in_transit: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
      failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return colors[status as keyof typeof colors] || colors.pending
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
      high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      low: 'bg-green-500/10 text-green-400 border-green-500/20',
    }
    return colors[priority as keyof typeof colors] || colors.normal
  }

  const isLoading = ordersLoading || driversLoading || routesLoading

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-slate-400 text-sm">Live Dispatch Center</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Real-time Operations</h1>
          <p className="text-slate-400">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <Button
          onClick={handleRefreshAll}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* Alert Cards */}
      {urgentOrders.length > 0 && (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Urgent Orders Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-300">
              {urgentOrders.length} urgent order{urgentOrders.length !== 1 ? 's' : ''} require immediate attention
            </p>
            <div className="mt-3 space-y-2">
              {urgentOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-2 bg-red-800/20 rounded">
                  <span className="text-red-200">#{order.order_number} - {order.customer_name}</span>
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30">URGENT</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Active Deliveries</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeOrders.length}</div>
            <p className="text-xs text-slate-400">Currently in progress</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Available Drivers</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{availableDrivers.length}</div>
            <p className="text-xs text-slate-400">Ready for assignment</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Active Routes</CardTitle>
            <MapPin className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeRoutes.length}</div>
            <p className="text-xs text-slate-400">Routes in progress</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {orders?.filter(o => o.status === 'pending').length || 0}
            </div>
            <p className="text-xs text-slate-400">Awaiting assignment</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Deliveries */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Active Deliveries
            </CardTitle>
            <CardDescription className="text-slate-400">
              Orders currently being delivered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-slate-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : activeOrders.length > 0 ? (
              activeOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-white">#{order.order_number}</p>
                        <p className="text-xs text-slate-400">{order.customer_name}</p>
                        <p className="text-xs text-slate-500">{order.delivery_address}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={`text-xs ${getPriorityColor(order.priority)}`}>
                      {order.priority}
                    </Badge>
                    <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No active deliveries</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Drivers */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Available Drivers
            </CardTitle>
            <CardDescription className="text-slate-400">
              Drivers ready for assignment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-slate-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : availableDrivers.length > 0 ? (
              availableDrivers.slice(0, 5).map((driver) => (
                <div key={driver.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {driver.first_name} {driver.last_name}
                      </p>
                      <p className="text-xs text-slate-400">{driver.email}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                    Available
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No drivers available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Activity</CardTitle>
          <CardDescription className="text-slate-400">
            Latest updates from the field
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orders?.slice(0, 10).map((order, index) => (
              <div key={order.id} className="flex items-center space-x-4 p-3 bg-slate-800 rounded-lg">
                <div className="flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${
                    order.status === 'delivered' ? 'bg-green-500' :
                    order.status === 'in_transit' ? 'bg-blue-500' :
                    order.status === 'assigned' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    Order #{order.order_number} - {order.customer_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    Status changed to {order.status.replace('_', ' ')} • {new Date(order.updated_at).toLocaleTimeString()}
                  </p>
                </div>
                <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                  {order.status.replace('_', ' ')}
                </Badge>
              </div>
            )) || (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No recent activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
