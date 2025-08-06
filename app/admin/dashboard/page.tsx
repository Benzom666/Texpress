'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Users, Route, TrendingUp, Clock, CheckCircle, AlertCircle, Truck, BarChart3, RefreshCw } from 'lucide-react'

interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  inTransitOrders: number
  completedOrders: number
  activeDrivers: number
  totalDrivers: number
  successRate: number
  deliveredToday: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inTransitOrders: 0,
    completedOrders: 0,
    activeDrivers: 0,
    totalDrivers: 0,
    successRate: 0,
    deliveredToday: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setStats({
        totalOrders: 156,
        pendingOrders: 23,
        inTransitOrders: 45,
        completedOrders: 88,
        activeDrivers: 12,
        totalDrivers: 18,
        successRate: 94,
        deliveredToday: 34
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const statCards = [
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: Package,
      description: 'All time orders',
      color: 'text-blue-600'
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders,
      icon: Clock,
      description: 'Awaiting assignment',
      color: 'text-yellow-600'
    },
    {
      title: 'In Transit',
      value: stats.inTransitOrders,
      icon: Truck,
      description: 'Currently delivering',
      color: 'text-orange-600'
    },
    {
      title: 'Completed Today',
      value: stats.deliveredToday,
      icon: CheckCircle,
      description: 'Delivered today',
      color: 'text-green-600'
    },
    {
      title: 'Active Drivers',
      value: `${stats.activeDrivers}/${stats.totalDrivers}`,
      icon: Users,
      description: 'Available drivers',
      color: 'text-purple-600'
    },
    {
      title: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: TrendingUp,
      description: 'Delivery success rate',
      color: 'text-green-600'
    }
  ]

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchStats} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400">Overview of your delivery operations</p>
        </div>
        <Button onClick={fetchStats} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-200">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {loading ? '...' : stat.value}
                </div>
                <p className="text-xs text-slate-400">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
            Overview
          </TabsTrigger>
          <TabsTrigger value="orders" className="data-[state=active]:bg-slate-700">
            Recent Orders
          </TabsTrigger>
          <TabsTrigger value="drivers" className="data-[state=active]:bg-slate-700">
            Driver Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-200">Order Status Distribution</CardTitle>
                <CardDescription className="text-slate-400">
                  Current status of all orders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Pending</span>
                  <Badge variant="secondary">{stats.pendingOrders}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">In Transit</span>
                  <Badge variant="default">{stats.inTransitOrders}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Completed</span>
                  <Badge className="bg-green-600">{stats.completedOrders}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-200">Performance Metrics</CardTitle>
                <CardDescription className="text-slate-400">
                  Key performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Success Rate</span>
                  <span className="text-green-400 font-semibold">{stats.successRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Active Drivers</span>
                  <span className="text-blue-400 font-semibold">
                    {stats.activeDrivers}/{stats.totalDrivers}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Delivered Today</span>
                  <span className="text-purple-400 font-semibold">{stats.deliveredToday}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-200">Recent Orders</CardTitle>
              <CardDescription className="text-slate-400">
                Latest order activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Order data will be loaded here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-200">Driver Status</CardTitle>
              <CardDescription className="text-slate-400">
                Current driver availability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Driver data will be loaded here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
