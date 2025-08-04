"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { MapPin, Eye, EyeOff, Layers, Target, RefreshCw } from "lucide-react"
import { directCoordinateMapRenderer } from "@/lib/direct-coordinate-map-renderer"

interface DirectCoordinateMapProps {
  warehouseCoordinates: [number, number]
  routes: Array<{
    route_number: number
    orders: Array<{
      id: string
      coordinates: [number, number]
      customer_name: string
      order_number: string
      stop_number?: number
      priority?: string
    }>
    color: string
    total_distance: number
    total_duration: number
    zone_coverage: string[]
  }>
  title?: string
  height?: string
  onOrderClick?: (orderId: string) => void
  showControls?: boolean
}

export function DirectCoordinateMapDisplay({
  warehouseCoordinates,
  routes,
  title = "Direct Coordinate Routes Map",
  height = "500px",
  onOrderClick,
  showControls = true,
}: DirectCoordinateMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [visibleRoutes, setVisibleRoutes] = useState<Set<number>>(new Set())
  const [showRouteLines, setShowRouteLines] = useState(true)
  const [showStopNumbers, setShowStopNumbers] = useState(true)
  const [showTraffic, setShowTraffic] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null)
  const [mapStyle, setMapStyle] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Initialize visible routes
  useEffect(() => {
    if (routes.length > 0) {
      setVisibleRoutes(new Set(routes.map((r) => r.route_number)))
    }
  }, [routes])

  // Initialize map when component mounts
  useEffect(() => {
    initializeMap()
    return () => {
      directCoordinateMapRenderer.destroy()
    }
  }, [])

  // Update map when routes or settings change
  useEffect(() => {
    if (mapLoaded) {
      updateMapRoutes()
    }
  }, [routes, visibleRoutes, showRouteLines, showStopNumbers, mapLoaded])

  const initializeMap = async () => {
    if (!mapRef.current) return

    try {
      setMapError(null)
      console.log("🗺️ Initializing direct coordinate map...")

      // Check if Google Maps is available
      if (typeof window === "undefined" || !window.google?.maps) {
        throw new Error("Google Maps JavaScript API not loaded")
      }

      // Validate warehouse coordinates
      if (!isValidCoordinate(warehouseCoordinates)) {
        throw new Error("Invalid warehouse coordinates provided")
      }

      const filteredRoutes = routes
        .filter((route) => visibleRoutes.has(route.route_number))
        .map((route) => ({
          ...route,
          orders: route.orders.filter((order) => isValidCoordinate(order.coordinates)),
        }))

      await directCoordinateMapRenderer.initializeMap({
        containerId: mapRef.current.id,
        warehouseCoordinates,
        routes: filteredRoutes,
        mapStyle,
        showTraffic,
        showRouteLines,
        showStopNumbers,
      })

      setMapLoaded(true)
      console.log("✅ Direct coordinate map initialized successfully")
    } catch (error) {
      console.error("❌ Failed to initialize map:", error)
      setMapError(error instanceof Error ? error.message : "Failed to load map")
    }
  }

  const updateMapRoutes = async () => {
    if (!mapLoaded) return

    try {
      const filteredRoutes = routes
        .filter((route) => visibleRoutes.has(route.route_number))
        .map((route) => ({
          ...route,
          orders: route.orders.filter((order) => isValidCoordinate(order.coordinates)),
        }))

      await directCoordinateMapRenderer.updateRoutes(filteredRoutes, {
        showRouteLines,
        showStopNumbers,
      })
    } catch (error) {
      console.error("❌ Failed to update map routes:", error)
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
    if (visibleRoutes.size === routes.length) {
      setVisibleRoutes(new Set())
    } else {
      setVisibleRoutes(new Set(routes.map((r) => r.route_number)))
    }
  }

  const focusOnRoute = (routeNumber: number) => {
    setSelectedRoute(selectedRoute === routeNumber ? null : routeNumber)

    const route = routes.find((r) => r.route_number === routeNumber)
    if (!route || route.orders.length === 0) return

    // Center map on first order of the route
    const firstOrder = route.orders[0]
    if (isValidCoordinate(firstOrder.coordinates)) {
      directCoordinateMapRenderer.centerOnCoordinates(firstOrder.coordinates, 13)
    }
  }

  const refreshMap = async () => {
    setIsRefreshing(true)
    try {
      await initializeMap()
    } finally {
      setIsRefreshing(false)
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
            {showControls && (
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
                  onClick={refreshMap}
                  disabled={isRefreshing}
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllRoutes}
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  <Layers className="h-4 w-4 mr-1" />
                  {visibleRoutes.size === routes.length ? "Hide All" : "Show All"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Map Container */}
            <div className="lg:col-span-3">
              <div
                ref={mapRef}
                id="direct-coordinate-map"
                className="w-full rounded-lg border border-slate-600"
                style={{ height }}
              />
              {!mapLoaded && !mapError && (
                <div className="flex items-center justify-center h-full bg-slate-700 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                    <p className="text-sm text-slate-300">Loading direct coordinate map...</p>
                  </div>
                </div>
              )}
              {mapError && (
                <div className="flex items-center justify-center h-full bg-red-900/20 rounded-lg border border-red-500/20">
                  <div className="text-center p-4">
                    <div className="text-red-400 mb-2">⚠️</div>
                    <h3 className="text-red-300 font-medium mb-2">Map Loading Error</h3>
                    <p className="text-sm text-red-400 mb-4">{mapError}</p>
                    <Button
                      onClick={refreshMap}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? "Retrying..." : "Retry"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls Panel */}
            {showControls && (
              <div className="space-y-4">
                {/* Map Settings */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-white">Map Settings</h4>

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
                  <h4 className="font-medium text-sm text-white">Routes ({routes.length})</h4>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {routes.map((route) => (
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

                {/* Coordinate Info */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-white">Warehouse Location</h4>
                  <div className="text-xs text-slate-400 bg-slate-700/50 p-2 rounded">
                    <div>Latitude: {warehouseCoordinates[0].toFixed(6)}</div>
                    <div>Longitude: {warehouseCoordinates[1].toFixed(6)}</div>
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
