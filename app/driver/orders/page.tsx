"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { DriverDashboardLayout } from "@/components/driver-dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import MobileMapWidget from "@/components/mobile-map-widget"
import { routeManager } from "@/lib/route-manager"
import { routePersistenceService } from "@/lib/route-persistence"
import { analytics } from "@/lib/analytics"
import {
  Package,
  Clock,
  CheckCircle,
  MapPin,
  Phone,
  Navigation,
  Search,
  Camera,
  AlertTriangle,
  Play,
  RotateCcw,
  User,
  Truck,
  Shuffle,
  Hash,
  Globe,
  Filter,
  QrCode,
} from "lucide-react"

interface OrderWithActions extends Order {
  canStart?: boolean
  canPickup?: boolean
  canDeliver?: boolean
  canComplete?: boolean
  stop_number?: number
  route_number?: string
  stop_label?: string
}

interface RouteState {
  isOptimized: boolean
  persistentRoute: any | null
  optimizedOrders: OrderWithActions[]
  lastOptimizedAt: string | null
}

export default function DriverOrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [orders, setOrders] = useState<OrderWithActions[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("active")
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const [routeState, setRouteState] = useState<RouteState>({
    isOptimized: false,
    persistentRoute: null,
    optimizedOrders: [],
    lastOptimizedAt: null,
  })

  const fetchingRef = useRef(false)
  const routeStateRef = useRef(routeState)

  useEffect(() => {
    routeStateRef.current = routeState
  }, [routeState])

  useEffect(() => {
    routePersistenceService.cleanupOldStates()
  }, [])

  useEffect(() => {
    if (profile) {
      initializeDriverData()
      analytics.trackUserAction("view_driver_orders_page", { driverId: profile.user_id })
    }
  }, [profile])

  useEffect(() => {
    if (profile && routeState.isOptimized) {
      routePersistenceService.saveRouteState(profile.user_id, {
        isOptimized: routeState.isOptimized,
        optimizedOrders: routeState.optimizedOrders,
        persistentRoute: routeState.persistentRoute,
        lastOptimizedAt: routeState.lastOptimizedAt || new Date().toISOString(),
      })
    }
  }, [profile, routeState])

  const initializeDriverData = async () => {
    await Promise.all([fetchOrdersAndRoute(), getDriverLocation()])
  }

  const getDriverLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.latitude, position.coords.longitude]
          setDriverLocation(coords)
        },
        (error) => {
          const defaultCoords: [number, number] = [43.6532, -79.3832]
          setDriverLocation(defaultCoords)
        },
      )
    } else {
      const defaultCoords: [number, number] = [43.6532, -79.3832]
      setDriverLocation(defaultCoords)
    }
  }

  const fetchOrdersAndRoute = useCallback(async () => {
    if (!profile || fetchingRef.current) return

    fetchingRef.current = true
    setLoading(true)

    try {
      const persistedState = routePersistenceService.loadRouteState(profile.user_id)

      if (persistedState && persistedState.isOptimized && persistedState.optimizedOrders.length > 0) {
        const orderIds = persistedState.optimizedOrders.map((order) => order.id)
        const { data: currentOrders, error } = await supabase
          .from("orders")
          .select("*")
          .in("id", orderIds)
          .eq("driver_id", profile.user_id)

        if (error) throw error

        const updatedOptimizedOrders = persistedState.optimizedOrders
          .map((persistedOrder) => {
            const currentOrder = currentOrders.find((order) => order.id === persistedOrder.id)
            if (currentOrder) {
              return {
                ...currentOrder,
                stop_number: persistedOrder.stop_number,
                route_number: persistedOrder.route_number,
                stop_label: persistedOrder.stop_label || `S${String(persistedOrder.stop_number || 1).padStart(2, "0")}`,
                canStart: currentOrder.status === "assigned",
                canDeliver: currentOrder.status === "assigned",
                canComplete: currentOrder.status === "in_transit",
              }
            }
            return persistedOrder
          })
          .filter((order) => currentOrders.some((current) => current.id === order.id))

        setOrders(updatedOptimizedOrders)
        setRouteState({
          isOptimized: true,
          persistentRoute: persistedState.persistentRoute,
          optimizedOrders: updatedOptimizedOrders,
          lastOptimizedAt: persistedState.lastOptimizedAt,
        })

        toast({
          title: "Route Restored",
          description: `Optimized route with ${updatedOptimizedOrders.length} stops restored from previous session.`,
        })

        return
      }

      const existingRoute = await routeManager.getCurrentRoute(profile.user_id)

      if (existingRoute && existingRoute.stops.length > 0) {
        const routeOrders = existingRoute.stops
          .filter((stop) => stop.order)
          .map((stop) => ({
            ...stop.order,
            stop_number: stop.sequence,
            route_number: existingRoute.route_number,
            stop_label: `S${String(stop.sequence).padStart(2, "0")}`,
            canStart: stop.order.status === "assigned",
            canDeliver: stop.order.status === "assigned",
            canComplete: stop.order.status === "in_transit",
          }))

        if (routeOrders.length > 0) {
          setOrders(routeOrders)
          setRouteState({
            isOptimized: true,
            persistentRoute: existingRoute,
            optimizedOrders: routeOrders,
            lastOptimizedAt: existingRoute.updatedAt,
          })

          toast({
            title: "Route Loaded",
            description: `Database route with ${routeOrders.length} stops loaded successfully.`,
          })
          return
        }
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", profile.user_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      const ordersWithActions = (data as Order[]).map((order) => ({
        ...order,
        canStart: order.status === "assigned",
        canDeliver: order.status === "assigned",
        canComplete: order.status === "in_transit",
      }))

      setOrders(ordersWithActions)
      setRouteState({
        isOptimized: false,
        persistentRoute: null,
        optimizedOrders: [],
        lastOptimizedAt: null,
      })
    } catch (error) {
      analytics.trackError(error as Error, { context: "fetchOrdersAndRoute" })
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [profile, toast])

  const optimizeDeliveryRoute = async () => {
    const allOrders = orders.filter((order) => !["delivered", "failed", "cancelled"].includes(order.status))

    if (allOrders.length === 0) {
      toast({
        title: "No Orders",
        description: "No active orders to optimize.",
        variant: "destructive",
      })
      return
    }

    if (!driverLocation) {
      toast({
        title: "Location Required",
        description: "Unable to determine your location for route optimization.",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)
    analytics.trackUserAction("optimize_route", { orderCount: allOrders.length, driverId: profile?.user_id })
    try {
      if (routeState.persistentRoute?.id) {
        await routeManager.safeEndRoute(routeState.persistentRoute.id)
      }

      toast({
        title: "Optimizing Route",
        description: "Finding nearest delivery to your location and creating optimal sequence...",
      })

      const newRoute = await routeManager.createOptimizedRoute(profile!.user_id, allOrders)

      if (newRoute.stops.length === 0) {
        toast({
          title: "Optimization Failed",
          description: "Route was created but contains no stops. Please try again.",
          variant: "destructive",
        })
        return
      }

      const routeOrders = newRoute.stops.map((stop) => ({
        ...stop.order,
        stop_number: stop.sequence,
        route_number: newRoute.route_number,
        stop_label: `S${String(stop.sequence).padStart(2, "0")}`,
        canStart: stop.order.status === "assigned",
        canDeliver: stop.order.status === "assigned",
        canComplete: stop.order.status === "in_transit",
      }))

      setOrders(routeOrders)
      const newRouteState = {
        isOptimized: true,
        persistentRoute: newRoute,
        optimizedOrders: routeOrders,
        lastOptimizedAt: newRoute.updatedAt,
      }
      setRouteState(newRouteState)

      toast({
        title: "Route Optimized",
        description: `Route created starting with nearest delivery. ${newRoute.stops.length} stops in optimal sequence.`,
      })
    } catch (error) {
      analytics.trackError(error as Error, { context: "optimizeDeliveryRoute" })
      toast({
        title: "Error",
        description: `Failed to optimize route: ${(error as Error).message}`,
        variant: "destructive",
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  const resetOptimization = async () => {
    analytics.trackUserAction("reset_route_optimization", { driverId: profile?.user_id })
    try {
      if (profile) {
        routePersistenceService.clearRouteState(profile.user_id)
      }

      if (routeState.persistentRoute?.id) {
        await routeManager.safeEndRoute(routeState.persistentRoute.id)
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", profile!.user_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      const resetOrders = (data as Order[]).map((order) => ({
        ...order,
        canStart: order.status === "assigned",
        canDeliver: order.status === "assigned",
        canComplete: order.status === "in_transit",
      }))

      setOrders(resetOrders)
      setRouteState({
        isOptimized: false,
        persistentRoute: null,
        optimizedOrders: [],
        lastOptimizedAt: null,
      })

      toast({
        title: "Route Reset",
        description: "Orders returned to original sequence. Route optimization cleared.",
      })
    } catch (error) {
      analytics.trackError(error as Error, { context: "resetOptimization" })
      if (profile) {
        routePersistenceService.clearRouteState(profile.user_id)
      }

      setRouteState({
        isOptimized: false,
        persistentRoute: null,
        optimizedOrders: [],
        lastOptimizedAt: null,
      })

      toast({
        title: "Route Reset",
        description:
          "Route optimization cleared. Some database operations may have failed but local state has been reset.",
        variant: "destructive",
      })
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string, notes?: string) => {
    analytics.trackUserAction("update_order_status", { orderId, newStatus, driverId: profile?.user_id })
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      if (error) throw error

      if (profile) {
        await supabase.from("order_updates").insert({
          order_id: orderId,
          driver_id: profile.user_id,
          status: newStatus,
          notes: notes || `Order status updated to ${newStatus.replace("_", " ")}`,
          latitude: driverLocation?.[0] || null,
          longitude: driverLocation?.[1] || null,
        })
      }

      if (newStatus === "delivered" && routeState.persistentRoute) {
        try {
          const updatedRoute = await routeManager.completeDelivery(routeState.persistentRoute.id, orderId, 15, 2)

          const updatedOrders = orders.map((order) => {
            if (order.id === orderId) {
              return {
                ...order,
                status: newStatus,
                canStart: false,
                canDeliver: false,
                canComplete: false,
              }
            }
            return order
          })

          const updatedOptimizedOrders = routeState.optimizedOrders.map((order) => {
            if (order.id === orderId) {
              return {
                ...order,
                status: newStatus,
                canStart: false,
                canDeliver: false,
                canComplete: false,
              }
            }
            return order
          })

          setOrders(updatedOrders)
          const newRouteState = {
            ...routeState,
            persistentRoute: updatedRoute,
            optimizedOrders: updatedOptimizedOrders,
            lastOptimizedAt: updatedRoute.updatedAt,
          }
          setRouteState(newRouteState)

          toast({
            title: "Delivery Completed",
            description: "Route updated with delivery completion.",
          })

          return
        } catch (routeError) {
          analytics.trackError(routeError as Error, { context: "updateOrderStatus_routeUpdate" })
        }
      }

      const updatedOrders = orders.map((order) => {
        if (order.id === orderId) {
          const updatedOrder = { ...order, status: newStatus }
          return {
            ...updatedOrder,
            canStart: updatedOrder.status === "assigned",
            canDeliver: updatedOrder.status === "assigned",
            canComplete: updatedOrder.status === "in_transit",
          }
        }
        return order
      })

      setOrders(updatedOrders)

      if (routeState.optimizedOrders.length > 0) {
        const updatedOptimizedOrders = routeState.optimizedOrders.map((order) => {
          if (order.id === orderId) {
            const updatedOrder = { ...order, status: newStatus }
            return {
              ...updatedOrder,
              canStart: updatedOrder.status === "assigned",
              canDeliver: updatedOrder.status === "assigned",
              canComplete: updatedOrder.status === "in_transit",
            }
          }
          return order
        })

        setRouteState((prev) => ({
          ...prev,
          optimizedOrders: updatedOptimizedOrders,
        }))
      }

      toast({
        title: "Status Updated",
        description: `Order status updated to ${newStatus.replace("_", " ")}`,
      })
    } catch (error) {
      analytics.trackError(error as Error, { context: "updateOrderStatus" })
      toast({
        title: "Error",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-gray-50 text-gray-700 border-gray-200", icon: Clock, label: "Pending" },
      assigned: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, label: "Assigned" },
      in_transit: { color: "bg-orange-50 text-orange-700 border-orange-200", icon: Navigation, label: "In Transit" },
      delivered: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle, label: "Delivered" },
      failed: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, label: "Failed" },
      cancelled: { color: "bg-gray-50 text-gray-700 border-gray-200", icon: AlertTriangle, label: "Cancelled" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: Package,
      label: status.replace("_", " "),
    }

    const Icon = config.icon

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: { color: "bg-red-100 text-red-800 border-red-200", label: "Urgent" },
      high: { color: "bg-orange-100 text-orange-800 border-orange-200", label: "High" },
      normal: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Normal" },
      low: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Low" },
    }

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal

    return (
      <Badge variant="outline" className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    )
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  const getOrdersByTab = (tab: string) => {
    switch (tab) {
      case "active":
        return filteredOrders.filter((order) => !["delivered", "failed"].includes(order.status))
      case "completed":
        return filteredOrders.filter((order) => order.status === "delivered")
      case "failed":
        return filteredOrders.filter((order) => order.status === "failed")
      default:
        return filteredOrders
    }
  }

  const getTabCount = (tab: string) => {
    return getOrdersByTab(tab).length
  }

  if (!profile) return null

  const activeOrders = getOrdersByTab("active")

  return (
    <DriverDashboardLayout
      title="My Orders"
      headerActions={
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/driver/scanner")}
            className="flex items-center"
          >
            <QrCode className="h-4 w-4 mr-1" />
            Scan
          </Button>
          {routeState.isOptimized ? (
            <Button variant="outline" size="sm" onClick={resetOptimization}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          ) : (
            <Button size="sm" onClick={optimizeDeliveryRoute} disabled={isOptimizing}>
              <Shuffle className="h-4 w-4 mr-1" />
              {isOptimizing ? "..." : "Optimize"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Orders</p>
                  <p className="text-2xl font-bold">{activeOrders.length}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Route Status</p>
                  <p className="text-sm font-medium">{routeState.isOptimized ? "Optimized" : "Standard"}</p>
                  {routeState.persistentRoute?.route_number && (
                    <p className="text-xs text-muted-foreground">{routeState.persistentRoute.route_number}</p>
                  )}
                </div>
                <Navigation className={`h-8 w-8 ${routeState.isOptimized ? "text-green-500" : "text-gray-400"}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {routeState.isOptimized && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">Route Optimized</p>
                    <p className="text-xs text-green-600">
                      {routeState.optimizedOrders.length} stops in optimal sequence
                      {routeState.persistentRoute?.route_number && (
                        <span className="ml-2 font-mono">({routeState.persistentRoute.route_number})</span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetOptimization}
                  className="border-green-300 text-green-700 hover:bg-green-100 bg-transparent"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <MobileMapWidget
          orders={routeState.optimizedOrders.length > 0 ? routeState.optimizedOrders : activeOrders}
          driverLocation={driverLocation}
          isOptimized={routeState.isOptimized}
          title={routeState.isOptimized ? "Optimized Route Map" : "Delivery Locations"}
        />

        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                </Button>

                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  {driverLocation && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Globe className="h-3 w-3" />
                      Located
                    </div>
                  )}
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Active ({getTabCount("active")})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Done ({getTabCount("completed")})
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Failed ({getTabCount("failed")})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("active")}
              loading={loading}
              onStatusUpdate={updateOrderStatus}
              onNavigate={(address) =>
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
              }
              onContact={(phone) => window.open(`tel:${phone}`)}
              onViewDetails={(orderId) => router.push(`/driver/orders/${orderId}`)}
              onStartPOD={(orderId) => router.push(`/driver/orders/${orderId}/pod`)}
              onCommunicate={(orderId) => router.push(`/driver/communication/${orderId}`)}
              showActions={true}
              isOptimized={routeState.isOptimized}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("completed")}
              loading={loading}
              onNavigate={(address) =>
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
              }
              onContact={(phone) => window.open(`tel:${phone}`)}
              onViewDetails={(orderId) => router.push(`/driver/orders/${orderId}`)}
              onViewPOD={(orderId) => router.push(`/driver/orders/${orderId}/pod-view`)}
              showActions={false}
              isOptimized={routeState.isOptimized}
            />
          </TabsContent>

          <TabsContent value="failed" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("failed")}
              loading={loading}
              onNavigate={(address) =>
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
              }
              onContact={(phone) => window.open(`tel:${phone}`)}
              onViewDetails={(orderId) => router.push(`/driver/orders/${orderId}`)}
              onRetry={(orderId) => updateOrderStatus(orderId, "assigned", "Order retry requested by driver")}
              showActions={false}
              isOptimized={routeState.isOptimized}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DriverDashboardLayout>
  )

  function OrdersList({
    orders,
    loading,
    onStatusUpdate,
    onNavigate,
    onContact,
    onViewDetails,
    onStartPOD,
    onViewPOD,
    onCommunicate,
    onRetry,
    showActions,
    isOptimized,
  }: {
    orders: OrderWithActions[]
    loading: boolean
    onStatusUpdate?: (orderId: string, status: string) => void
    onNavigate: (address: string) => void
    onContact: (phone: string) => void
    onViewDetails: (orderId: string) => void
    onStartPOD?: (orderId: string) => void
    onViewPOD?: (orderId: string) => void
    onCommunicate?: (orderId: string) => void
    onRetry?: (orderId: string) => void
    showActions: boolean
    isOptimized: boolean
  }) {
    if (loading) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">Loading orders...</div>
          </CardContent>
        </Card>
      )
    }

    if (orders.length === 0) {
      return (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-12">
              <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No orders found</h3>
              <p className="text-muted-foreground">
                {activeTab === "active"
                  ? "No active orders at the moment"
                  : activeTab === "completed"
                    ? "No completed deliveries yet"
                    : "No failed orders"}
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isOptimized && order.stop_number && (
                      <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        <Hash className="h-3 w-3" />
                        {order.stop_label || `S${String(order.stop_number).padStart(2, "0")}`}
                      </div>
                    )}
                    {isOptimized && order.route_number && (
                      <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                        <Navigation className="h-3 w-3" />
                        {order.route_number}
                      </div>
                    )}
                    <h3 className="font-semibold">#{order.order_number}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(order.status)}
                    {getPriorityBadge(order.priority)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{order.customer_name}</span>
                    {order.customer_phone && (
                      <button
                        className="text-blue-600 hover:underline text-sm ml-auto"
                        onClick={() => onContact(order.customer_phone!)}
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground flex-1">{order.delivery_address}</p>
                  </div>
                </div>

                {order.delivery_notes && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">Notes:</span> {order.delivery_notes}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => onViewDetails(order.id)}>
                    View
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => onNavigate(order.delivery_address)}>
                    <MapPin className="mr-1 h-3 w-3" />
                    Navigate
                  </Button>

                  {showActions && onStatusUpdate && (
                    <>
                      {order.canStart && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onStatusUpdate!(order.id, "in_transit")
                          }}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Start
                        </Button>
                      )}

                      {order.canComplete && onStartPOD && (
                        <Button size="sm" onClick={() => onStartPOD(order.id)}>
                          <Camera className="mr-1 h-3 w-3" />
                          Complete
                        </Button>
                      )}
                    </>
                  )}

                  {order.status === "delivered" && onViewPOD && (
                    <Button variant="outline" size="sm" onClick={() => onViewPOD(order.id)}>
                      <Camera className="mr-1 h-3 w-3" />
                      POD
                    </Button>
                  )}

                  {order.status === "failed" && onRetry && (
                    <Button variant="outline" size="sm" onClick={() => onRetry(order.id)}>
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
}
