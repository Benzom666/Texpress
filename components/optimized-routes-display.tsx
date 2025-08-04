"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { MapPin, Clock, Package, Route, BarChart3, User, AlertTriangle, Timer, Navigation, Target } from "lucide-react"

interface OptimizedRoute {
  route_number: number
  driver_id?: string
  orders: any[]
  total_distance: number
  total_duration: number
  zone_coverage: string[]
  optimization_score: number
}

interface OptimizationResult {
  routes: OptimizedRoute[]
  optimization_metrics: {
    total_routes: number
    total_stops: number
    total_distance: number
    total_duration: number
    average_stops_per_route: number
    optimization_score: number
  }
  unassigned_orders: any[]
  google_api_calls_used: number
  processing_time: number
}

interface OptimizedRoutesDisplayProps {
  result: OptimizationResult
  adminId: string
}

export function OptimizedRoutesDisplay({ result, adminId }: OptimizedRoutesDisplayProps) {
  const { toast } = useToast()
  const [selectedRoute, setSelectedRoute] = useState<OptimizedRoute | null>(null)
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)

  // Mock drivers data - in real app, this would come from API
  const availableDrivers = [
    { id: "1", name: "John Smith", status: "available", current_load: 0 },
    { id: "2", name: "Sarah Johnson", status: "available", current_load: 2 },
    { id: "3", name: "Mike Wilson", status: "busy", current_load: 8 },
    { id: "4", name: "Emma Davis", status: "available", current_load: 1 },
  ]

  const handleAssignDriver = async (routeNumber: number, driverId: string) => {
    setAssigningDriver(`${routeNumber}-${driverId}`)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Driver Assigned",
        description: `Route ${routeNumber} has been assigned to ${availableDrivers.find((d) => d.id === driverId)?.name}`,
      })
    } catch (error) {
      toast({
        title: "Assignment Failed",
        description: "Failed to assign driver to route",
        variant: "destructive",
      })
    } finally {
      setAssigningDriver(null)
    }
  }

  const getRouteStatusColor = (score: number) => {
    if (score >= 90) return "bg-green-500"
    if (score >= 75) return "bg-yellow-500"
    return "bg-red-500"
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (!result || !result.routes) {
    return (
      <div className="text-center py-8 text-slate-400">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No optimization results to display.</p>
      </div>
    )
  }

  // Safe access to result properties with fallbacks
  const safeResult = {
    routes: result?.routes || [],
    unassigned_orders: result?.unassigned_orders || [],
    optimization_metrics: result?.optimization_metrics || {
      total_stops: 0,
      total_routes: 0,
      total_distance: 0,
      total_duration: 0,
      optimization_score: 0,
      average_stops_per_route: 0,
    },
    google_api_calls_used: result?.google_api_calls_used || 0,
    processing_time: result?.processing_time || 0,
  }

  return (
    <div className="space-y-6">
      {/* Optimization Summary */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5" />
            Optimization Summary
          </CardTitle>
          <CardDescription className="text-slate-400">Results from route optimization analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {safeResult.optimization_metrics?.total_routes || 0}
              </div>
              <div className="text-sm text-slate-400">Routes Created</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {safeResult.optimization_metrics?.total_stops || 0}
              </div>
              <div className="text-sm text-slate-400">Total Stops</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {Math.round((safeResult.optimization_metrics?.total_distance || 0) * 100) / 100} km
              </div>
              <div className="text-sm text-slate-400">Total Distance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">
                {formatDuration(safeResult.optimization_metrics?.total_duration || 0)}
              </div>
              <div className="text-sm text-slate-400">Total Time</div>
            </div>
          </div>

          <Separator className="my-4 bg-slate-600" />

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-400" />
              <span className="text-slate-300">
                Optimization Score: {Math.round((safeResult.optimization_metrics?.optimization_score || 0) * 100) / 100}
                %
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-blue-400" />
              <span className="text-slate-300">Processing Time: {safeResult.processing_time || 0}s</span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-purple-400" />
              <span className="text-slate-300">API Calls Used: {safeResult.google_api_calls_used || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(safeResult.routes || []).map((route) => (
          <Card key={route.route_number} className="relative bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">Route {route.route_number}</CardTitle>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${getRouteStatusColor(route.optimization_score)}`}
                    title={`Optimization Score: ${route.optimization_score}%`}
                  />
                  <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                    {route.optimization_score}% optimal
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-300">{(route.orders || []).length} stops</span>
                </div>
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-green-400" />
                  <span className="text-slate-300">{route.total_distance} km</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-400" />
                  <span className="text-slate-300">{formatDuration(route.total_duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-purple-400" />
                  <span className="text-slate-300">{(route.zone_coverage || []).slice(0, 2).join(", ")}</span>
                </div>
              </div>

              <Separator className="bg-slate-600" />

              {/* Driver Assignment */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Assign Driver</label>
                <Select
                  onValueChange={(driverId) => handleAssignDriver(route.route_number, driverId)}
                  disabled={assigningDriver === `${route.route_number}-${route.driver_id}`}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select driver..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {availableDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id} disabled={driver.status === "busy"}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{driver.name}</span>
                          <Badge variant={driver.status === "available" ? "default" : "secondary"} className="ml-auto">
                            {driver.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                    onClick={() => setSelectedRoute(route)}
                  >
                    View Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-800 border-slate-700 text-white">
                  <DialogHeader>
                    <DialogTitle>Route {route.route_number} Details</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Detailed view of route optimization and stops
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs defaultValue="timeline" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-700 border-slate-600">
                      <TabsTrigger
                        value="timeline"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                      >
                        Timeline
                      </TabsTrigger>
                      <TabsTrigger
                        value="orders"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                      >
                        Orders
                      </TabsTrigger>
                      <TabsTrigger
                        value="metrics"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                      >
                        Metrics
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="timeline" className="mt-4">
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                          {(route.orders || []).map((order, index) => (
                            <div
                              key={order.id}
                              className="flex items-start gap-4 p-3 border border-slate-600 rounded-lg bg-slate-700"
                            >
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium text-white">
                                {index + 1}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="font-medium text-white">{order.customer_name}</div>
                                <div className="text-sm text-slate-400">{order.delivery_address}</div>
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                  <span>ETA: {new Date(order.estimated_arrival).toLocaleTimeString()}</span>
                                  <span>Zone: {order.zone}</span>
                                </div>
                              </div>
                              <Badge variant="outline" className="border-slate-500 text-slate-300">
                                {order.order_number}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="orders" className="mt-4">
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2">
                          {(route.orders || []).map((order) => (
                            <Card key={order.id} className="bg-slate-700 border-slate-600">
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium text-white">{order.customer_name}</div>
                                    <div className="text-sm text-slate-400">{order.delivery_address}</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                      Order: {order.order_number} | Stop: {order.stop_number}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="bg-slate-600 text-slate-200">
                                    {order.priority || "Normal"}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="metrics" className="mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 bg-slate-700 border-slate-600">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-400">{route.total_distance} km</div>
                            <div className="text-sm text-slate-400">Total Distance</div>
                          </div>
                        </Card>
                        <Card className="p-4 bg-slate-700 border-slate-600">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">
                              {formatDuration(route.total_duration)}
                            </div>
                            <div className="text-sm text-slate-400">Total Duration</div>
                          </div>
                        </Card>
                        <Card className="p-4 bg-slate-700 border-slate-600">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-400">{(route.orders || []).length}</div>
                            <div className="text-sm text-slate-400">Total Stops</div>
                          </div>
                        </Card>
                        <Card className="p-4 bg-slate-700 border-slate-600">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-400">{route.optimization_score}%</div>
                            <div className="text-sm text-slate-400">Optimization Score</div>
                          </div>
                        </Card>
                      </div>

                      <Card className="p-4 mt-4 bg-slate-700 border-slate-600">
                        <h4 className="font-medium mb-2 text-white">Zone Coverage</h4>
                        <div className="flex flex-wrap gap-2">
                          {(route.zone_coverage || []).map((zone, index) => (
                            <Badge key={index} variant="outline" className="border-slate-500 text-slate-300">
                              {zone}
                            </Badge>
                          ))}
                        </div>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unassigned Orders */}
      {safeResult.unassigned_orders && safeResult.unassigned_orders.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Unassigned Orders ({safeResult.unassigned_orders.length})
            </CardTitle>
            <CardDescription className="text-slate-400">Orders that could not be optimized into routes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safeResult.unassigned_orders.map((order) => (
                <Card key={order.id} className="p-3 border-yellow-600 bg-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-white">{order.customer_name}</div>
                      <div className="text-sm text-slate-400">{order.delivery_address}</div>
                    </div>
                    <Badge variant="outline" className="text-yellow-400 border-yellow-600">
                      {order.order_number}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
