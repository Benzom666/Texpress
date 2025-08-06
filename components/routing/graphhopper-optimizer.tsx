"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Route, Truck, Settings, Play, RefreshCw, Printer, UserPlus, AlertCircle, CheckCircle } from "lucide-react"

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  coordinates?: [number, number]
  priority: "urgent" | "high" | "normal" | "low"
  status: string
}

interface OptimizationSettings {
  warehouseLocation: [number, number]
  warehouseName: string
  maxOrdersPerRoute: number
  optimizationMethod: "distance" | "time" | "hybrid"
  considerTraffic: boolean
  considerPriority: boolean
  considerTimeWindows: boolean
  vehicleCapacity: number
  workingHours: {
    start: string
    end: string
  }
  vehicleType?: string
  maxRoutes?: number
}

interface OptimizedRoute {
  routeId: string
  routeNumber: string
  driverId?: string
  stops: Array<{
    stopNumber: number
    orderId: string
    orderNumber: string
    address: string
    coordinates: [number, number]
    estimatedArrival: string
    estimatedDeparture: string
    serviceDuration: number
    instructions?: string
  }>
  totalDistance: number
  totalDuration: number
  totalDrivingTime: number
}

interface Driver {
  id: string
  user_id: string
  name: string
  email: string
  status: string
}

interface GraphHopperOptimizerProps {
  selectedOrders: Order[]
  drivers: Driver[]
  adminId: string
  onOptimizationComplete?: (routes: OptimizedRoute[]) => void
  onRouteAssigned?: (routeId: string, driverId: string) => void
}

export function GraphHopperOptimizer({
  selectedOrders,
  drivers,
  adminId,
  onOptimizationComplete,
  onRouteAssigned,
}: GraphHopperOptimizerProps) {
  const { toast } = useToast()

  // State management
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizedRoutes, setOptimizedRoutes] = useState<OptimizedRoute[]>([])
  const [optimizationProgress, setOptimizationProgress] = useState(0)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedRouteForAssignment, setSelectedRouteForAssignment] = useState<string | null>(null)
  const [showReoptimizeDialog, setShowReoptimizeDialog] = useState(false)
  const [selectedRouteForReoptimization, setSelectedRouteForReoptimization] = useState<string | null>(null)

  // Optimization settings
  const [settings, setSettings] = useState<OptimizationSettings>({
    warehouseLocation: [43.6532, -79.3832], // Toronto downtown
    warehouseName: "Main Warehouse",
    maxOrdersPerRoute: 12,
    optimizationMethod: "hybrid",
    considerTraffic: true,
    considerPriority: true,
    considerTimeWindows: false,
    vehicleCapacity: 1000,
    workingHours: {
      start: "08:00",
      end: "18:00",
    },
    vehicleType: "small_truck",
    maxRoutes: 3,
  })

  const [vehicleCount, setVehicleCount] = useState(1)

  // Load existing routes on component mount
  useEffect(() => {
    loadExistingRoutes()
  }, [adminId])

  const loadExistingRoutes = async () => {
    try {
      const response = await fetch(`/api/optimize-routes-graphhopper?adminId=${adminId}`)
      const data = await response.json()

      if (data.success && data.data.routes) {
        const formattedRoutes = data.data.routes.map((route: any) => ({
          routeId: route.id,
          routeNumber: route.route_number,
          driverId: route.driver_id,
          stops:
            route.route_stops?.map((stop: any) => ({
              stopNumber: stop.stop_number,
              orderId: stop.order_id,
              orderNumber: stop.orders?.order_number || "Unknown",
              address: stop.address,
              coordinates: [0, 0], // Would need to parse PostGIS point
              estimatedArrival: stop.estimated_arrival_time,
              estimatedDeparture: stop.estimated_departure_time,
              serviceDuration: stop.service_duration,
              instructions: stop.instructions,
            })) || [],
          totalDistance: route.total_distance || 0,
          totalDuration: route.total_duration || 0,
          totalDrivingTime: route.total_driving_time || 0,
        }))
        setOptimizedRoutes(formattedRoutes)
      }
    } catch (error) {
      console.error("❌ Error loading existing routes:", error)
    }
  }

  const handleOptimizeRoutes = async () => {
    if (selectedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to optimize routes.",
        variant: "destructive",
      })
      return
    }

    // Check if orders have coordinates
    const ordersWithCoordinates = selectedOrders.filter((order) => order.coordinates && order.coordinates.length === 2)

    if (ordersWithCoordinates.length === 0) {
      toast({
        title: "Missing Coordinates",
        description: "Please geocode the selected orders before optimizing routes.",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)
    setOptimizationProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setOptimizationProgress((prev) => Math.min(prev + 10, 90))
      }, 500)

      const response = await fetch("/api/optimize-routes-graphhopper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selectedOrders.map((order) => order.id),
          settings,
          vehicleCount,
          adminId,
        }),
      })

      clearInterval(progressInterval)
      setOptimizationProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Optimization failed")
      }

      if (data.success && data.data.routes) {
        setOptimizedRoutes(data.data.routes)
        onOptimizationComplete?.(data.data.routes)

        toast({
          title: "Routes Optimized Successfully",
          description: `Generated ${data.data.routes.length} optimized routes for ${data.data.totalOrders} orders.`,
        })

        if (data.data.skippedOrders > 0) {
          toast({
            title: "Some Orders Skipped",
            description: `${data.data.skippedOrders} orders were skipped due to missing coordinates.`,
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("❌ Route optimization error:", error)
      toast({
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "Failed to optimize routes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsOptimizing(false)
      setOptimizationProgress(0)
    }
  }

  const handleAssignRoute = async (routeId: string, driverId: string) => {
    try {
      const response = await fetch("/api/assign-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId,
          driverId,
          assignedBy: adminId,
          assignmentReason: "Manual assignment via GraphHopper optimizer",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Assignment failed")
      }

      // Update local state
      setOptimizedRoutes((prev) => prev.map((route) => (route.routeId === routeId ? { ...route, driverId } : route)))

      onRouteAssigned?.(routeId, driverId)

      const driver = drivers.find((d) => d.user_id === driverId)
      toast({
        title: "Route Assigned Successfully",
        description: `Route assigned to ${driver?.name || "driver"}.`,
      })

      setShowAssignDialog(false)
      setSelectedRouteForAssignment(null)
    } catch (error) {
      console.error("❌ Route assignment error:", error)
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign route. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReoptimizeRoute = async (routeId: string, newSettings: Partial<OptimizationSettings>) => {
    try {
      const response = await fetch("/api/reoptimize-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId,
          newSettings,
          adminId,
          reason: "Manual re-optimization via GraphHopper optimizer",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Re-optimization failed")
      }

      // Reload routes to get updated data
      await loadExistingRoutes()

      toast({
        title: "Route Re-optimized Successfully",
        description: `Route has been re-optimized with improved efficiency.`,
      })

      setShowReoptimizeDialog(false)
      setSelectedRouteForReoptimization(null)
    } catch (error) {
      console.error("❌ Route re-optimization error:", error)
      toast({
        title: "Re-optimization Failed",
        description: error instanceof Error ? error.message : "Failed to re-optimize route. Please try again.",
        variant: "destructive",
      })
    }
  }

  const generateRouteLabel = async (routeId: string) => {
    try {
      const response = await fetch("/api/generate-route-label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId,
          labelType: "route_summary",
          format: "pdf",
          includeMap: true,
          includeQrCode: true,
          includeBarcode: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate route label")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `route-label-${routeId}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Route Label Generated",
        description: "Route label has been downloaded successfully.",
      })
    } catch (error) {
      console.error("❌ Route label generation error:", error)
      toast({
        title: "Label Generation Failed",
        description: "Failed to generate route label. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getPriorityBadge = (priority: string) => {
    const colors = {
      urgent: "bg-red-100 text-red-800",
      high: "bg-orange-100 text-orange-800",
      normal: "bg-blue-100 text-blue-800",
      low: "bg-gray-100 text-gray-800",
    }
    return <Badge className={colors[priority as keyof typeof colors] || colors.normal}>{priority}</Badge>
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatDistance = (km: number) => {
    return `${km.toFixed(1)} km`
  }

  return (
    <div className="space-y-6">
      {/* Optimization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            GraphHopper Route Optimization
          </CardTitle>
          <CardDescription>
            Configure optimization parameters and generate efficient delivery routes using GraphHopper's advanced
            algorithms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Settings</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
              <TabsTrigger value="vehicles">Vehicle Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouse-name">Warehouse/Depot Name</Label>
                  <Input
                    id="warehouse-name"
                    value={settings.warehouseName}
                    onChange={(e) => setSettings((prev) => ({ ...prev, warehouseName: e.target.value }))}
                    placeholder="Main Warehouse"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-orders">Max Orders per Route</Label>
                  <Input
                    id="max-orders"
                    type="number"
                    min="1"
                    max="50"
                    value={settings.maxOrdersPerRoute}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, maxOrdersPerRoute: Number.parseInt(e.target.value) || 12 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="optimization-method">Optimization Method</Label>
                  <Select
                    value={settings.optimizationMethod}
                    onValueChange={(value: "distance" | "time" | "hybrid") =>
                      setSettings((prev) => ({ ...prev, optimizationMethod: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distance">Minimize Distance</SelectItem>
                      <SelectItem value="time">Minimize Time</SelectItem>
                      <SelectItem value="hybrid">Balanced (Recommended)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-count">Number of Vehicles</Label>
                  <Input
                    id="vehicle-count"
                    type="number"
                    min="1"
                    max="10"
                    value={vehicleCount}
                    onChange={(e) => setVehicleCount(Number.parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Working Hours Start</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={settings.workingHours.start}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, start: e.target.value },
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-time">Working Hours End</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={settings.workingHours.end}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, end: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="consider-traffic"
                    checked={settings.considerTraffic}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, considerTraffic: checked as boolean }))
                    }
                  />
                  <Label htmlFor="consider-traffic">Consider Real-time Traffic</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="consider-priority"
                    checked={settings.considerPriority}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, considerPriority: checked as boolean }))
                    }
                  />
                  <Label htmlFor="consider-priority">Prioritize Urgent Orders</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="consider-time-windows"
                    checked={settings.considerTimeWindows}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, considerTimeWindows: checked as boolean }))
                    }
                  />
                  <Label htmlFor="consider-time-windows">Respect Delivery Time Windows</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vehicles" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle-type">Vehicle Type</Label>
                  <Select
                    value={settings.vehicleType}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, vehicleType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small_truck">Small Truck</SelectItem>
                      <SelectItem value="medium_truck">Medium Truck</SelectItem>
                      <SelectItem value="large_truck">Large Truck</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-capacity">Vehicle Capacity (kg)</Label>
                  <Input
                    id="vehicle-capacity"
                    type="number"
                    min="50"
                    max="10000"
                    value={settings.vehicleCapacity}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, vehicleCapacity: Number.parseInt(e.target.value) || 1000 }))
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-muted-foreground">
              {selectedOrders.length} orders selected for optimization
            </div>
            <Button
              onClick={handleOptimizeRoutes}
              disabled={isOptimizing || selectedOrders.length === 0}
              className="flex items-center gap-2"
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Optimize Routes
                </>
              )}
            </Button>
          </div>

          {isOptimizing && (
            <div className="mt-4">
              <Progress value={optimizationProgress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Optimizing routes with GraphHopper... {optimizationProgress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimized Routes Results */}
      {optimizedRoutes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Optimized Routes ({optimizedRoutes.length})
            </CardTitle>
            <CardDescription>Generated routes with stop sequences and driver assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {optimizedRoutes.map((route) => (
                <Card key={route.routeId} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{route.routeNumber}</CardTitle>
                        <CardDescription>
                          {route.stops.length} stops • {formatDistance(route.totalDistance)} •{" "}
                          {formatDuration(route.totalDuration)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {route.driverId ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Assigned
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Unassigned
                          </Badge>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRouteForAssignment(route.routeId)
                            setShowAssignDialog(true)
                          }}
                          disabled={!!route.driverId}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          {route.driverId ? "Assigned" : "Assign Driver"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRouteForReoptimization(route.routeId)
                            setShowReoptimizeDialog(true)
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Re-optimize
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => generateRouteLabel(route.routeId)}>
                          <Printer className="h-4 w-4 mr-1" />
                          Print Label
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Route Stops:</h4>
                      <div className="grid gap-2">
                        {route.stops.map((stop) => (
                          <div
                            key={stop.stopNumber}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                variant="outline"
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                              >
                                {stop.stopNumber}
                              </Badge>
                              <div>
                                <p className="font-medium text-sm">{stop.orderNumber}</p>
                                <p className="text-xs text-muted-foreground">{stop.address}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                ETA: {new Date(stop.estimatedArrival).toLocaleTimeString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Service: {Math.round(stop.serviceDuration / 60)}min
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Route to Driver</DialogTitle>
            <DialogDescription>Select a driver to assign this optimized route.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {drivers.length === 0 ? (
              <p className="text-muted-foreground">No available drivers found.</p>
            ) : (
              <div className="space-y-2">
                {drivers.map((driver) => (
                  <Button
                    key={driver.user_id}
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    onClick={() =>
                      selectedRouteForAssignment && handleAssignRoute(selectedRouteForAssignment, driver.user_id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{driver.email}</p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Re-optimization Dialog */}
      <Dialog open={showReoptimizeDialog} onOpenChange={setShowReoptimizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-optimize Route</DialogTitle>
            <DialogDescription>Adjust settings and re-optimize this route for better efficiency.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Optimization Focus</Label>
              <Select defaultValue="hybrid">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distance">Minimize Distance</SelectItem>
                  <SelectItem value="time">Minimize Time</SelectItem>
                  <SelectItem value="hybrid">Balanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="reopt-traffic" defaultChecked />
              <Label htmlFor="reopt-traffic">Consider Traffic</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReoptimizeDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  selectedRouteForReoptimization &&
                  handleReoptimizeRoute(selectedRouteForReoptimization, { optimizationMethod: "hybrid" })
                }
              >
                Re-optimize
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
