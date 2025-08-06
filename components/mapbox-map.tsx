"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { MapPin, Clock, Package, Route, RefreshCw, AlertCircle, Zap } from "lucide-react"

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  coordinates?: [number, number]
  priority: "urgent" | "high" | "normal" | "low"
  status: string
}

interface OptimizedRoute {
  id: string
  name: string
  orders: Array<{
    id: string
    order_number: string
    customer_name: string
    delivery_address: string
    coordinates: [number, number]
    priority: string
    estimatedArrival: string
    distanceFromPrevious: number
    timeFromPrevious: number
  }>
  totalDistance: number
  totalTime: number
  estimatedDuration: string
  waypoints: Array<[number, number]>
}

interface MapboxMapProps {
  orders: Order[]
  warehouseLocation: [number, number]
  warehouseName: string
  title?: string
  height?: string
  showRouteOptimization?: boolean
  onOrderClick?: (orderId: string) => void
}

export function MapboxMap({
  orders,
  warehouseLocation,
  warehouseName,
  title = "Delivery Map",
  height = "400px",
  showRouteOptimization = false,
  onOrderClick,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optimizedRoutes, setOptimizedRoutes] = useState<OptimizedRoute[]>([])
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [mapboxLoaded, setMapboxLoaded] = useState(false)

  // Load Mapbox GL JS
  useEffect(() => {
    const loadMapbox = async () => {
      try {
        // Check if Mapbox is already loaded
        if (typeof window !== "undefined" && (window as any).mapboxgl) {
          setMapboxLoaded(true)
          return
        }

        // Load Mapbox CSS
        const cssLink = document.createElement("link")
        cssLink.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css"
        cssLink.rel = "stylesheet"
        document.head.appendChild(cssLink)

        // Load Mapbox JS
        const script = document.createElement("script")
        script.src = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"
        script.onload = () => {
          setMapboxLoaded(true)
        }
        script.onerror = () => {
          setError("Failed to load Mapbox GL JS")
          setIsLoading(false)
        }
        document.head.appendChild(script)
      } catch (err) {
        console.error("Error loading Mapbox:", err)
        setError("Failed to load mapping library")
        setIsLoading(false)
      }
    }

    loadMapbox()
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapboxLoaded || !mapContainer.current || map.current) return

    try {
      const mapboxgl = (window as any).mapboxgl

      if (!mapboxgl) {
        setError("Mapbox GL JS not available")
        setIsLoading(false)
        return
      }

      // Check for access token
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      if (!accessToken) {
        console.warn("⚠️ Mapbox access token not found, using fallback map")
        setError("Map service not configured")
        setIsLoading(false)
        return
      }

      mapboxgl.accessToken = accessToken

      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: warehouseLocation,
        zoom: 11,
      })

      map.current.on("load", () => {
        console.log("✅ Map loaded successfully")
        setIsLoading(false)
        addMarkersToMap()
      })

      map.current.on("error", (e: any) => {
        console.error("❌ Map error:", e)
        setError("Failed to load map")
        setIsLoading(false)
      })
    } catch (err) {
      console.error("❌ Error initializing map:", err)
      setError("Failed to initialize map")
      setIsLoading(false)
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [mapboxLoaded, warehouseLocation])

  // Add markers when orders change
  useEffect(() => {
    if (map.current && !isLoading) {
      addMarkersToMap()
    }
  }, [orders, isLoading])

  const addMarkersToMap = () => {
    if (!map.current) return

    try {
      const mapboxgl = (window as any).mapboxgl

      // Clear existing markers
      const existingMarkers = document.querySelectorAll(".mapbox-marker")
      existingMarkers.forEach((marker) => marker.remove())

      // Add warehouse marker
      const warehouseEl = document.createElement("div")
      warehouseEl.className = "mapbox-marker warehouse-marker"
      warehouseEl.innerHTML = `
        <div style="
          background: #10b981;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          cursor: pointer;
        ">
          <div style="color: white; font-size: 16px;">🏢</div>
        </div>
      `

      new mapboxgl.Marker(warehouseEl)
        .setLngLat(formatCoordinates(warehouseLocation))
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="margin: 0 0 4px 0; font-weight: bold;">${warehouseName}</h3>
              <p style="margin: 0; color: #666; font-size: 12px;">Warehouse Location</p>
            </div>
          `),
        )
        .addTo(map.current)

      // Add order markers
      const validOrders = orders.filter(
        (order) =>
          order.coordinates &&
          Array.isArray(order.coordinates) &&
          order.coordinates.length === 2 &&
          !isNaN(order.coordinates[0]) &&
          !isNaN(order.coordinates[1]),
      )

      console.log(`📍 Adding ${validOrders.length} order markers to map`)

      validOrders.forEach((order) => {
        const coordinates = formatCoordinates(order.coordinates!)

        const priorityColors = {
          urgent: "#ef4444",
          high: "#f97316",
          normal: "#3b82f6",
          low: "#6b7280",
        }

        const statusIcons = {
          pending: "⏳",
          assigned: "👤",
          in_transit: "🚚",
          delivered: "✅",
          failed: "❌",
        }

        const el = document.createElement("div")
        el.className = "mapbox-marker order-marker"
        el.innerHTML = `
          <div style="
            background: ${priorityColors[order.priority] || priorityColors.normal};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            cursor: pointer;
            font-size: 12px;
          ">
            ${statusIcons[order.status as keyof typeof statusIcons] || "📦"}
          </div>
        `

        el.addEventListener("click", () => {
          if (onOrderClick) {
            onOrderClick(order.id)
          }
        })

        new mapboxgl.Marker(el)
          .setLngLat(coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 4px 0; font-weight: bold;">${order.order_number}</h3>
                <p style="margin: 0 0 4px 0; font-weight: 500;">${order.customer_name}</p>
                <p style="margin: 0 0 8px 0; color: #666; font-size: 12px;">${order.delivery_address}</p>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <span style="
                    background: ${priorityColors[order.priority]};
                    color: white;
                    padding: 2px 6px;
                    border-radius: 12px;
                    font-size: 10px;
                    text-transform: uppercase;
                  ">${order.priority}</span>
                  <span style="
                    background: #f3f4f6;
                    color: #374151;
                    padding: 2px 6px;
                    border-radius: 12px;
                    font-size: 10px;
                    text-transform: uppercase;
                  ">${order.status}</span>
                </div>
              </div>
            `),
          )
          .addTo(map.current)
      })

      // Fit map to show all markers
      if (validOrders.length > 0) {
        const coordinates = [warehouseLocation, ...validOrders.map((order) => order.coordinates!)]

        const bounds = new mapboxgl.LngLatBounds()
        coordinates.forEach((coord) => {
          bounds.extend(formatCoordinates(coord))
        })

        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
        })
      }
    } catch (error) {
      console.error("❌ Error adding markers:", error)
      setError("Failed to display order locations")
    }
  }

  const formatCoordinates = (coords: [number, number]): [number, number] => {
    if (!coords || coords.length !== 2) {
      console.warn("⚠️ Invalid coordinates, using Toronto fallback:", coords)
      return [-79.3832, 43.6532] // Toronto fallback
    }

    const [first, second] = coords

    if (isNaN(first) || isNaN(second)) {
      console.warn("⚠️ NaN coordinates detected, using Toronto fallback:", coords)
      return [-79.3832, 43.6532]
    }

    // Ensure longitude, latitude format for Mapbox
    // If first coordinate is > 90, it's likely longitude
    if (Math.abs(first) > 90) {
      return [first, second] // Already lng, lat
    } else {
      return [second, first] // Convert lat, lng to lng, lat
    }
  }

  const optimizeRoutes = async () => {
    if (isOptimizing) return

    setIsOptimizing(true)
    try {
      console.log("🚚 Starting route optimization...")

      const ordersWithCoordinates = orders.filter(
        (order) =>
          order.coordinates &&
          Array.isArray(order.coordinates) &&
          order.coordinates.length === 2 &&
          !isNaN(order.coordinates[0]) &&
          !isNaN(order.coordinates[1]),
      )

      if (ordersWithCoordinates.length === 0) {
        throw new Error("No orders with valid coordinates found")
      }

      const response = await fetch("/api/optimize-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orders: ordersWithCoordinates,
          warehouseLocation,
          settings: {
            maxOrdersPerRoute: 12,
            optimizationMethod: "hybrid",
            considerPriority: true,
            considerTimeWindows: true,
            vehicleCapacity: 50,
            workingHours: {
              start: "08:00",
              end: "18:00",
            },
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Route optimization failed")
      }

      const result = await response.json()
      setOptimizedRoutes(result.routes || [])

      console.log(`✅ Generated ${result.routes?.length || 0} optimized routes`)
    } catch (error) {
      console.error("❌ Route optimization error:", error)
      setError(error instanceof Error ? error.message : "Route optimization failed")
    } finally {
      setIsOptimizing(false)
    }
  }

  const getPriorityBadge = (priority: string) => {
    const config = {
      urgent: { color: "bg-red-100 text-red-800", icon: Zap },
      high: { color: "bg-orange-100 text-orange-800", icon: AlertCircle },
      normal: { color: "bg-blue-100 text-blue-800", icon: Package },
      low: { color: "bg-gray-100 text-gray-800", icon: Clock },
    }

    const { color, icon: Icon } = config[priority as keyof typeof config] || config.normal

    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {priority}
      </Badge>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Order Locations</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between text-sm">
                  <span>{order.order_number}</span>
                  <span className="text-muted-foreground">{order.customer_name}</span>
                </div>
              ))}
              {orders.length > 5 && (
                <p className="text-xs text-muted-foreground">...and {orders.length - 5} more orders</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {title}
            </CardTitle>
            {showRouteOptimization && (
              <Button onClick={optimizeRoutes} disabled={isOptimizing || orders.length === 0} size="sm">
                <Route className={`h-4 w-4 mr-2 ${isOptimizing ? "animate-spin" : ""}`} />
                {isOptimizing ? "Optimizing..." : "Optimize Routes"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={mapContainer}
            style={{ height }}
            className="w-full rounded-lg border bg-gray-100 flex items-center justify-center"
          >
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Loading map...
              </div>
            )}
          </div>

          {!isLoading && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>📍 {orders.length} orders</span>
                <span>🏢 1 warehouse</span>
                {orders.filter((o) => o.coordinates).length !== orders.length && (
                  <span className="text-orange-600">
                    ⚠️ {orders.length - orders.filter((o) => o.coordinates).length} not geocoded
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Urgent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Normal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span>Low</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimized Routes Display */}
      {optimizedRoutes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Optimized Routes ({optimizedRoutes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {optimizedRoutes.map((route, index) => (
                <div key={route.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{route.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{route.totalDistance.toFixed(1)} km</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{route.estimatedDuration}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{route.orders.length} stops</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {route.orders.map((order, orderIndex) => (
                      <div key={order.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono bg-white px-2 py-1 rounded">{orderIndex + 1}</span>
                          <div>
                            <p className="font-medium text-sm">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(order.priority)}
                          <span className="text-xs text-muted-foreground">ETA: {order.estimatedArrival}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
