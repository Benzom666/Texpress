'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MapboxMap } from '@/components/mapbox-map'
import { useOrders, useDrivers } from '@/hooks/useApi'
import { apiClient } from '@/lib/api'
import { Search, Filter, MapPin, Clock, User, Package, AlertCircle, RefreshCw, Route, CheckSquare, Square } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: string
  coordinates?: [number, number]
  created_at: string
  phone_number?: string
  email?: string
  special_instructions?: string
}

export default function OrdersPage() {
  // Stable state management
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    status: 'all',
    priority: 'all',
    search: ''
  })
  
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [optimizing, setOptimizing] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<string>('')

  // Refs for stable callbacks
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  // Memoized API parameters to prevent unnecessary re-renders
  const apiParams = useMemo(() => ({
    page: filters.page,
    limit: filters.limit,
    status: filters.status === 'all' ? undefined : filters.status,
    priority: filters.priority === 'all' ? undefined : filters.priority,
    search: filters.search || undefined
  }), [filters.page, filters.limit, filters.status, filters.priority, filters.search])

  // API calls with stable dependencies
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useOrders(apiParams)
  const { data: driversData, loading: driversLoading } = useDrivers({ available: true })

  // Memoized derived data
  const orders = useMemo(() => ordersData?.data?.orders || [], [ordersData])
  const pagination = useMemo(() => ordersData?.data?.pagination, [ordersData])
  const drivers = useMemo(() => driversData?.data?.drivers || [], [driversData])

  // Stable callback functions using useCallback with proper dependencies
  const handleSearchChange = useCallback((value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value, page: 1 }))
    }, 300)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }, [])

  const handleOrderSelect = useCallback((orderId: string, checked: boolean) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(orderId)
      } else {
        newSet.delete(orderId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(orders.map(order => order.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }, [orders])

  const handleOptimizeRoute = useCallback(async () => {
    if (selectedOrders.size === 0) {
      alert('Please select orders to optimize')
      return
    }

    if (!selectedDriver) {
      alert('Please select a driver')
      return
    }

    setOptimizing(true)
    try {
      const result = await apiClient.optimizeSelectedOrders({
        orderIds: Array.from(selectedOrders),
        driverId: selectedDriver,
        optimizationType: 'distance'
      })

      if (result.error) {
        throw new Error(result.error)
      }

      alert(`Route optimized successfully! Total distance: ${result.data?.totalDistance}km, Total time: ${result.data?.totalTime} minutes`)
      setSelectedOrders(new Set())
      refetchOrders()
    } catch (error) {
      console.error('Optimization failed:', error)
      alert('Failed to optimize route. Please try again.')
    } finally {
      setOptimizing(false)
    }
  }, [selectedOrders, selectedDriver, refetchOrders])

  // Memoized filtered orders for map display
  const ordersWithCoordinates = useMemo(() => 
    orders.filter(order => order.coordinates && order.coordinates.length === 2),
    [orders]
  )

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'normal': return 'bg-green-500'
      case 'low': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }, [])

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'assigned': return 'bg-blue-500'
      case 'in_transit': return 'bg-purple-500'
      case 'delivered': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }, [])

  if (ordersError) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Failed to load orders: {ordersError}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders Management</h1>
          <p className="text-muted-foreground">
            Manage and optimize delivery orders
          </p>
        </div>
        <Button onClick={refetchOrders} disabled={ordersLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${ordersLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                className="pl-10"
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            
            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground flex items-center">
              <Package className="h-4 w-4 mr-1" />
              {pagination?.total || 0} total orders
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Route Optimization */}
      {selectedOrders.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">
                    {selectedOrders.size} orders selected
                  </span>
                </div>
                
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {driver.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedOrders(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  onClick={handleOptimizeRoute}
                  disabled={optimizing || !selectedDriver || driversLoading}
                >
                  <Route className={`h-4 w-4 mr-2 ${optimizing ? 'animate-spin' : ''}`} />
                  {optimizing ? 'Optimizing...' : 'Optimize Route'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map View */}
      {ordersWithCoordinates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Orders Map View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MapboxMap
              orders={ordersWithCoordinates}
              center={[-79.3832, 43.6532]}
              zoom={10}
              className="h-96"
            />
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Orders List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No orders found matching your criteria
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedOrders.size === orders.length && orders.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={(checked) => handleOrderSelect(order.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {order.delivery_address}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getPriorityColor(order.priority)} text-white`}>
                          {order.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(order.status)} text-white`}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} orders
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
