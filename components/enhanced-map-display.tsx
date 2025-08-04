"use client"

import { Label } from "@/components/ui/label"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Eye, EyeOff, Layers, Target } from "lucide-react"
import { directCoordinateMapRenderer } from "@/lib/direct-coordinate-map-renderer"

interface OptimizationResult {
  routes: Array<{
    route_number: number
    orders: Array<{
      id: string
      order_number: string
      customer_name: string
      customer_email: string
      customer_phone?: string
      delivery_address: string
      priority: "urgent" | "high" | "normal" | "low"
      coordinates: [number, number]
      stop_number: number
      estimated_arrival: string
      estimated_duration: number
      zone: string
    }>
    total_distance: number
    total_duration: number
    estimated_start: string
    estimated_end: string
    optimization_score: number
    zone_coverage: string[]
    color: string
  }>
  unassigned_orders: any[]
  total_distance: number
  total_duration: number
  optimization_metrics: any
  warehouse_coordinates: [number, number]
  created_at: string
}

interface EnhancedMapDisplayProps {
  optimizationResult?: OptimizationResult
  warehouseLocation: [number, number]
  warehouseName?: string
  title?: string
  height?: string
  onOrderClick?: (orderId: string) => void
  showRouteControls?: boolean
}

export function EnhancedMapDisplay({
  optimizationResult,
  warehouseLocation,
  warehouseName = "Warehouse",
  title = "Enhanced Delivery Routes Map",
  height = "500px",
  onOrderClick,
  showRouteControls = true,
}: EnhancedMapDisplayProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [visibleRoutes, setVisibleRoutes] = useState<Set<number>>(new Set())
  const [showAllOrders, setShowAllOrders] = useState(true)
  const [showWarehouse, setShowWarehouse] = useState(true)
  const [showRouteLines, setShowRouteLines] = useState(true)
  const [showStopNumbers, setShowStopNumbers] = useState(true)
  const [showTraffic, setShowTraffic] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null)
  const [mapStyle, setMapStyle] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap")

  // Initialize visible routes when optimization result changes
  useEffect(() => {
    if (optimizationResult && optimizationResult.routes) {
      const allRouteNumbers = new Set(optimizationResult.routes.map((r) => r.route_number))
      setVisibleRoutes(allRouteNumbers)
    }
  }, [optimizationResult])

  // Initialize map when component mounts
  useEffect(() => {
    initializeMap()
    return () => {
      directCoordinateMapRenderer.destroy()
    }
  }, [])

  // Update map when optimization result or settings change
  useEffect(() => {
    if (mapLoaded && optimizationResult) {
      updateMapWithOptimizationResult()
    }
  }, [optimizationResult, visibleRoutes, showRouteLines, showStopNumbers, showWarehouse, mapLoaded])

  const initializeMap = async () => {
    if (!mapRef.current) return

    try {
      setMapError(null)
      console.log("🗺️ Initializing enhanced map with direct coordinates...")

      // Check if Google Maps is available
      if (typeof window === "undefined" || !window.google?.maps) {
        throw new Error("Google Maps JavaScript API not loaded")
      }

      // Validate warehouse coordinates
      if (!isValidCoordinate(warehouseLocation)) {
        throw new Error("Invalid warehouse coordinates provided")
      }

      // Initialize with empty routes first
      await directCoordinateMapRenderer.initializeMap({
        containerId: mapRef.current.id,
        warehouseCoordinates: warehouseLocation,
        routes: [],
        mapStyle,
        showTraffic,
        showRouteLines,
        showStopNumbers,
      })

      setMapLoaded(true)
      console.log("✅ Enhanced map initialized successfully")

      // Update with optimization result if available
      if (optimizationResult) {
        updateMapWithOptimizationResult()
      }
    } catch (error) {
      console.error("❌ Failed to initialize enhanced map:", error)
      setMapError(error instanceof Error ? error.message : "Failed to load map")
    }
  }

  const updateMapWithOptimizationResult = async () => {
    if (!mapLoaded || !optimizationResult) return

    try {
      const filteredRoutes = optimizationResult.routes
        .filter((route) => visibleRoutes.has(route.route_number))
        .map((route) => ({
          route_number: route.route_number,
          orders: route.orders
            .filter((order) => isValidCoordinate(order.coordinates))
            .map((order) => ({
              id: order.id,
              coordinates: order.coordinates,
              customer_name: order.customer_name,
              order_number: order.order_number,
              stop_number: order.stop_number,
              priority: order.priority,
            })),
          color: route.color,
          total_distance: route.total_distance,
          total_duration: route.total_duration,
          zone_coverage: route.zone_coverage,
        }))

      await directCoordinateMapRenderer.updateRoutes(filteredRoutes, {
        showRouteLines,
        showStopNumbers,
      })

      console.log(`✅ Map updated with ${filteredRoutes.length} visible routes`)
    } catch (error) {
      console.error("❌ Failed to update map with optimization result:", error)
    }
  }

  const isValidCoordinate = (coordinates: [number, number]): boolean => {
    const [lat, lng] = coordinates
    return (
      typeof lat === "number" &&
      typeof lng === "number" &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    )
  }

  const toggleRouteVisibility = (routeNumber: number) => {
    const newVisibleRoutes = new Set(visibleRoutes)
    if (newVisibleRoutes.has(routeNumber)) {
      newVisibleRoutes.delete(routeNumber)
    } else {
      newVisibleRoutes.add(routeNumber)
    }
    setVisibleRoutes(newVisibleRoutes)
  }

  const toggleAllRoutes = () => {
    if (!optimizationResult) return

    if (visibleRoutes.size === optimizationResult.routes.length) {
      setVisibleRoutes(new Set())
    } else {
      setVisibleRoutes(new Set(optimizationResult.routes.map((r) => r.route_number)))
    }
  }

  const focusOnRoute = (routeNumber: number) => {
    setSelectedRoute(selectedRoute === routeNumber ? null : routeNumber)

    if (!optimizationResult) return

    const route = optimizationResult.routes.find((r) => r.route_number === routeNumber)
    if (!route || route.orders.length === 0) return

    // Center map on first order of the route
    const firstOrder = route.orders[0]
    if (isValidCoordinate(firstOrder.coordinates)) {
      directCoordinateMapRenderer.centerOnCoordinates(firstOrder.coordinates, 13)
    }
  }

  const handleMapStyleChange = async (newStyle: "roadmap" | "satellite" | "hybrid" | "terrain") => {
    setMapStyle(newStyle)
    // Reinitialize map with new style
    await initializeMap()
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <MapPin className="h-5 w-5 text-blue-400" />
              {title}
            </CardTitle>
            {showRouteControls && optimizationResult && (
              <div className="flex items-center gap-2">
                <Select value={mapStyle} onValueChange={handleMapStyleChange}>
                  <SelectTrigger className="w-[140px] bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="roadmap">Roadmap</SelectItem>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="terrain">Terrain</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllRoutes}
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  <Layers className="h-4 w-4 mr-1" />
                  {visibleRoutes.size === optimizationResult.routes.length ? "Hide All" : "Show All"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Map */}
            <div className="lg:col-span-3">
              <div
                ref={mapRef}
                id="enhanced-direct-coordinate-map"
                className="w-full rounded-lg border border-slate-600"
                style={{ height }}
              />
              {!mapLoaded && !mapError && (
                <div className="flex items-center justify-center h-full bg-slate-700 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                    <p className="text-sm text-slate-300">Loading enhanced map...</p>
                  </div>
                </div>
              )}
              {mapError && (
                <div className="flex items-center justify-center h-full bg-red-900/20 rounded-lg border border-red-500/20">
                  <div className="text-center p-4">
                    <div className="text-red-400 mb-2">⚠️</div>
                    <h3 className="text-red-300 font-medium mb-2">Map Loading Error</h3>
                    <p className="text-sm text-red-400 mb-4">{mapError}</p>
                    <Button onClick={initializeMap} size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            {showRouteControls && optimizationResult && (
              <div className="space-y-4">
                {/* Map Controls */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-white">Map Controls</h4>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-warehouse" className="text-sm text-slate-300">
                      Show Warehouse
                    </Label>
                    <Switch
                      id="show-warehouse"
                      checked={showWarehouse}
                      onCheckedChange={setShowWarehouse}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-route-lines" className="text-sm text-slate-300">
                      Route Lines
                    </Label>
                    <Switch
                      id="show-route-lines"
                      checked={showRouteLines}
                      onCheckedChange={setShowRouteLines}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-stop-numbers" className="text-sm text-slate-300">
                      Stop Numbers
                    </Label>
                    <Switch
                      id="show-stop-numbers"
                      checked={showStopNumbers}
                      onCheckedChange={setShowStopNumbers}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-traffic" className="text-sm text-slate-300">
                      Traffic Layer
                    </Label>
                    <Switch
                      id="show-traffic"
                      checked={showTraffic}
                      onCheckedChange={setShowTraffic}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                </div>

                {/* Route List */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-white">Routes ({optimizationResult.routes.length})</h4>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {optimizationResult.routes.map((route) => (
                      <div
                        key={route.route_number}
                        className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                          selectedRoute === route.route_number
                            ? "border-blue-400 bg-blue-900/20"
                            : "border-slate-600 hover:bg-slate-700/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full border border-white"
                              style={{ backgroundColor: route.color }}
                            />
                            <span className="font-medium text-sm text-white">Route {route.route_number}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleRouteVisibility(route.route_number)
                              }}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                            >
                              {visibleRoutes.has(route.route_number) ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                focusOnRoute(route.route_number)
                              }}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                            >
                              <Target className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-slate-400 space-y-1">
                          <div className="flex justify-between">
                            <span>{route.orders.length} stops</span>
                            <span>{route.total_distance.toFixed(1)} km</span>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {route.zone_coverage.slice(0, 2).map((zone) => (
                              <Badge key={zone} variant="outline" className="text-xs px-1 py-0 border-slate-500">
                                {zone}
                              </Badge>
                            ))}
                            {route.zone_coverage.length > 2 && (
                              <Badge variant="outline" className="text-xs px-1 py-0 border-slate-500">
                                +{route.zone_coverage.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warehouse Info */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-white">{warehouseName}</h4>
                  <div className="text-xs text-slate-400 bg-slate-700/50 p-2 rounded">
                    <div>Latitude: {warehouseLocation[0].toFixed(6)}</div>
                    <div>Longitude: {warehouseLocation[1].toFixed(6)}</div>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-white">Legend</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-800 rounded-full border-2 border-white"></div>
                      <span className="text-slate-300">Warehouse</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                      <span className="text-slate-300">Delivery Stop</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-blue-500"></div>
                      <span className="text-slate-300">Route Path</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
