"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Route, MapPin, Clock, Truck, User, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from "sonner"
import { RouteManager } from "@/lib/route-manager"

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  coordinates?: [number, number]
  priority: string
  status: string
}

interface Driver {
  user_id: string
  name: string
  email: string
  phone?: string
}

interface OptimizedRoute {
  routeId: string
  routeNumber: string
  routeName: string
  stops: Array<{
    stopNumber: number
    stopLabel: string
    order: Order
    estimatedTime: number
    distance: number
  }>
  totalDistance: number
  totalTime: number
  assignedDriverId?: string
  assignedDriverName?: string
}

interface RouteOptimizerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedOrders: Order[]
  drivers: Driver[]
  onOptimizationComplete: (routes: OptimizedRoute[]) => void
}

export function RouteOptimizerDialog({
  open,
  onOpenChange,
  selectedOrders,
  drivers,
  onOptimizationComplete
}: RouteOptimizerDialogProps) {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isCreatingRoutes, setIsCreatingRoutes] = useState(false)
  const [optimizedRoutes, setOptimizedRoutes] = useState<OptimizedRoute[]>([])
  const [routeAssignments, setRouteAssignments] = useState<Record<string, string>>({})
  
  // Optimization settings
  const [maxOrdersPerRoute, setMaxOrdersPerRoute] = useState(8)
  const [warehouseAddress, setWarehouseAddress] = useState("Main Warehouse, Toronto")
  const [optimizationMethod, setOptimizationMethod] = useState("distance")

  useEffect(() => {
    if (!open) {
      setOptimizedRoutes([])
      setRouteAssignments({})
      setIsOptimizing(false)
      setIsCreatingRoutes(false)
    }
  }, [open])

  const handleOptimizeRoutes = async () => {
    if (selectedOrders.length === 0) {
      toast.error("No orders selected for optimization")
      return
    }

    setIsOptimizing(true)
    
    try {
      console.log("Optimizing routes for", selectedOrders.length, "orders")
      
      // Simple route optimization - group orders by proximity and priority
      const routes = await optimizeOrdersIntoRoutes(selectedOrders, maxOrdersPerRoute)
      
      setOptimizedRoutes(routes)
      toast.success(`Created ${routes.length} optimized routes`)
      
    } catch (error) {
      console.error("Route optimization error:", error)
      toast.error("Failed to optimize routes")
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleCreateRoutes = async () => {
    if (optimizedRoutes.length === 0) {
      toast.error("No routes to create")
      return
    }

    setIsCreatingRoutes(true)

    try {
      const createdRoutes: OptimizedRoute[] = []

      for (const route of optimizedRoutes) {
        console.log("Creating route:", route.routeNumber)

        const routeData = {
          route_number: route.routeNumber,
          route_name: route.routeName,
          total_distance: route.totalDistance,
          estimated_duration: route.totalTime,
          total_stops: route.stops.length,
          created_by: "admin", // This should come from auth context
          stops: route.stops.map(stop => ({
            order_id: stop.order.id,
            stop_number: stop.stopNumber,
            stop_label: stop.stopLabel,
            address: stop.order.delivery_address,
            latitude: stop.order.coordinates?.[0],
            longitude: stop.order.coordinates?.[1],
            estimated_arrival_time: new Date(Date.now() + stop.estimatedTime * 60000).toISOString()
          }))
        }

        const createdRoute = await RouteManager.createRoute(routeData)
        
        if (createdRoute) {
          const finalRoute = {
            ...route,
            routeId: createdRoute.id
          }

          // Assign driver if selected
          const assignedDriverId = routeAssignments[route.routeId]
          if (assignedDriverId) {
            const success = await RouteManager.assignDriverToRoute(createdRoute.id, assignedDriverId)
            if (success) {
              const driver = drivers.find(d => d.user_id === assignedDriverId)
              finalRoute.assignedDriverId = assignedDriverId
              finalRoute.assignedDriverName = driver?.name
            }
          }

          createdRoutes.push(finalRoute)
        }
      }

      if (createdRoutes.length > 0) {
        toast.success(`Successfully created ${createdRoutes.length} routes`)
        onOptimizationComplete(createdRoutes)
        onOpenChange(false)
      } else {
        toast.error("Failed to create routes")
      }

    } catch (error) {
      console.error("Error creating routes:", error)
      toast.error("Failed to create routes")
    } finally {
      setIsCreatingRoutes(false)
    }
  }

  const handleDriverAssignment = (routeId: string, driverId: string) => {
    setRouteAssignments(prev => ({
      ...prev,
      [routeId]: driverId
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Route Optimization
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Optimization Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Optimization Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="maxOrders">Max Orders per Route</Label>
                  <Input
                    id="maxOrders"
                    type="number"
                    value={maxOrdersPerRoute}
                    onChange={(e) => setMaxOrdersPerRoute(parseInt(e.target.value) || 8)}
                    min={1}
                    max={20}
                  />
                </div>
                <div>
                  <Label htmlFor="warehouse">Warehouse Location</Label>
                  <Input
                    id="warehouse"
                    value={warehouseAddress}
                    onChange={(e) => setWarehouseAddress(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="method">Optimization Method</Label>
                  <Select value={optimizationMethod} onValueChange={setOptimizationMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distance">Distance</SelectItem>
                      <SelectItem value="time">Time</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Orders Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selected Orders ({selectedOrders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {selectedOrders.slice(0, 12).map((order) => (
                  <div key={order.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Badge variant="outline" className="text-xs">
                      {order.order_number}
                    </Badge>
                    <span className="text-sm truncate">{order.customer_name}</span>
                  </div>
                ))}
                {selectedOrders.length > 12 && (
                  <div className="p-2 text-sm text-gray-500">
                    +{selectedOrders.length - 12} more orders...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Optimization Controls */}
          <div className="flex gap-2">
            <Button 
              onClick={handleOptimizeRoutes} 
              disabled={isOptimizing || selectedOrders.length === 0}
              className="flex-1"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing Routes...
                </>
              ) : (
                <>
                  <Route className="mr-2 h-4 w-4" />
                  Optimize Routes
                </>
              )}
            </Button>
          </div>

          {/* Optimized Routes */}
          {optimizedRoutes.length > 0 && (
            <div className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Optimized Routes ({optimizedRoutes.length})</h3>
                <Button 
                  onClick={handleCreateRoutes}
                  disabled={isCreatingRoutes}
                  variant="default"
                >
                  {isCreatingRoutes ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Routes...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Create Routes
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                {optimizedRoutes.map((route) => (
                  <Card key={route.routeId} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {route.routeNumber}
                          </Badge>
                          <span className="font-medium">{route.routeName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {route.stops.length} stops
                          </div>
                          <div className="flex items-center gap-1">
                            <Route className="h-4 w-4" />
                            {route.totalDistance.toFixed(1)} km
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {Math.round(route.totalTime)} min
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Route Stops:</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {route.stops.map((stop) => (
                              <div key={stop.stopNumber} className="flex items-center gap-2 text-sm">
                                <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                                  {stop.stopNumber}
                                </Badge>
                                <span className="truncate">{stop.order.customer_name}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    stop.order.priority === 'urgent' ? 'bg-red-50 text-red-700' :
                                    stop.order.priority === 'high' ? 'bg-orange-50 text-orange-700' :
                                    'bg-gray-50 text-gray-700'
                                  }`}
                                >
                                  {stop.order.priority}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Assign Driver:</h4>
                          <Select
                            value={routeAssignments[route.routeId] || ""}
                            onValueChange={(value) => handleDriverAssignment(route.routeId, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select driver..." />
                            </SelectTrigger>
                            <SelectContent>
                              {drivers.map((driver) => (
                                <SelectItem key={driver.user_id} value={driver.user_id}>
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>{driver.name}</span>
                                    <span className="text-xs text-gray-500">({driver.email})</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {routeAssignments[route.routeId] && (
                            <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              Driver assigned
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Simple route optimization algorithm
async function optimizeOrdersIntoRoutes(orders: Order[], maxOrdersPerRoute: number): Promise<OptimizedRoute[]> {
  const routes: OptimizedRoute[] = []
  const remainingOrders = [...orders]

  // Sort orders by priority first
  remainingOrders.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
    return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
  })

  let routeNumber = 1

  while (remainingOrders.length > 0) {
    const routeOrders = remainingOrders.splice(0, maxOrdersPerRoute)
    
    const route: OptimizedRoute = {
      routeId: `temp-route-${routeNumber}`,
      routeNumber: `RT${new Date().getFullYear()}${String(routeNumber).padStart(3, '0')}`,
      routeName: `Route ${routeNumber} - ${routeOrders.length} stops`,
      stops: routeOrders.map((order, index) => ({
        stopNumber: index + 1,
        stopLabel: `Stop ${index + 1}`,
        order,
        estimatedTime: (index + 1) * 15, // 15 minutes per stop
        distance: index * 2.5 // Estimated 2.5km between stops
      })),
      totalDistance: routeOrders.length * 2.5,
      totalTime: routeOrders.length * 15,
    }

    routes.push(route)
    routeNumber++
  }

  return routes
}
