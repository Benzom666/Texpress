'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Download, Upload, MapPin, Search, Package, Truck, CheckCircle, XCircle, Plus, MoreHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useOrders } from '@/hooks/useApi'
import Link from 'next/link'

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const { data: orders, loading, error, refetch } = useOrders({
    status: statusFilter,
    priority: priorityFilter
  })

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  }) || []

  const stats = {
    all: orders?.length || 0,
    active: orders?.filter(o => o.status === 'assigned' || o.status === 'in_transit').length || 0,
    completed: orders?.filter(o => o.status === 'delivered').length || 0,
    failed: orders?.filter(o => o.status === 'failed').length || 0
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
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
          <h1 className="text-2xl font-bold text-white mb-1">Orders Management</h1>
          <p className="text-slate-400">Manage and track all delivery orders with route optimization</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
            <MapPin className="h-4 w-4 mr-2" />
            Geocode All
          </Button>
          <Button
            onClick={refetch}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">All</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.all}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Active</CardTitle>
            <Truck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search orders by number, customer, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Orders ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-slate-800 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Error Loading Orders</h3>
              <p className="text-slate-400 mb-4">{error}</p>
              <Button onClick={refetch} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="text-sm font-medium text-white">#{order.order_number}</p>
                      <p className="text-xs text-slate-400">{order.customer_name}</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs">{order.delivery_address}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col space-y-1">
                      <Badge className={`text-xs ${getPriorityColor(order.priority)}`}>
                        {order.priority}
                      </Badge>
                      <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-slate-800 border-slate-700">
                        <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">
                          Edit Order
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">
                          Assign Driver
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400 hover:bg-slate-700">
                          Cancel Order
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">No orders found</h3>
              <p className="text-slate-400 mb-4">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first order to get started'}
              </p>
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
    </div>
  )
}
