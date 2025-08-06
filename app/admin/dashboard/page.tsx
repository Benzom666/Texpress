'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Plus, Package, Truck, Users, TrendingUp, MapPin, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { useDashboardStats, useOrders } from '@/hooks/useApi'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats()
  const { data: recentOrders, loading: ordersLoading, refetch: refetchOrders } = useOrders({ limit: 5 })

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchOrders()])
  }

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

  if (statsError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Error Loading Dashboard</h3>
          <p className="text-slate-400 mb-4">{statsError}</p>
          <Button onClick={handleRefresh} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
              <span className="text-slate-300 font-bold text-sm">D</span>
            </div>
            <span className="text-slate-400 text-sm">DeliveryOS</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome back! Here's what's happening with your deliveries.
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRefresh}
            disabled={statsLoading}
            variant="outline"
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/admin/orders/create">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : stats?.totalOrders || 0}
            </div>
            <p className="text-xs text-slate-400">
              {stats?.pendingOrders || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : stats?.inTransitOrders || 0}
            </div>
            <p className="text-xs text-slate-400">Currently delivering</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Active Drivers</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : stats?.activeDrivers || 0}
            </div>
            <p className="text-xs text-slate-400">
              of {stats?.totalDrivers || 0} total drivers
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? '...' : `${stats?.successRate || 0}%`}
            </div>
            <p className="text-xs text-slate-400">
              {stats?.deliveredToday || 0} delivered today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Recent Orders</CardTitle>
              <CardDescription className="text-slate-400">Latest order updates</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-blue-400 hover:text-blue-300">
              <Link href="/admin/orders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-white">#{order.order_number}</p>
                        <p className="text-xs text-slate-400">{order.customer_name}</p>
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
                <Package className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">No orders yet</h3>
                <p className="text-slate-400 mb-4">Create your first order to get started</p>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/admin/orders/create">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Order
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Delivery Tracking */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Live Delivery Tracking
            </CardTitle>
            <CardDescription className="text-slate-400">Real-time delivery status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 bg-slate-800 rounded-lg">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">No active deliveries</p>
                <p className="text-slate-500 text-xs mt-1">Map will show live tracking when deliveries are in progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
