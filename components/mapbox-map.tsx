"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { MapPin, AlertCircle, RefreshCw, List, Navigation, Route, Zap, Target } from "lucide-react"
import { geocodingService } from "@/lib/geocoding-service"

// Mapbox GL JS types
declare global {
  interface Window {
    mapboxgl: any
  }
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  status: string
  coordinates?: [number, number]
}

interface DriverLocation {
  id: string
  name: string
  location: [number, number]
  orders: number
  status: string
  last_seen: string
}

interface OptimizedRoute {
  waypoints: Array<{
    coordinates: [number, number]
    name: string
    address?: string
  }>
  distance: number
  duration: number
  geometry: [number, number][]
}

interface MapboxMapProps {
  orders: Order[]
  driverLocations?: DriverLocation[]
  warehouseLocation?: [number, number]
  warehouseName?: string
  title?: string
  height?: string
  onOrderClick?: (orderId: string) => void
  className?: string
  showRouteOptimization?: boolean
}

export function MapboxMap({
  orders = [],
  driverLocations = [],
  warehouseLocation,
  warehouseName = "Warehouse",
  title = "Delivery Map",
  height = "400px",
  onOrderClick,
  className,
  showRouteOptimization = false,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null)
  const [processedOrders, setProcessedOrders] = useState<Order[]>([])
  const { toast } = useToast()

  // Load Mapbox GL JS once
  useEffect(() => {
    let mounted = true

    const loadMapbox = async () => {
      try {
        if (typeof window === "undefined") return

        if (window.mapboxgl) {
          if (mounted) initializeMap()
          return
        }

        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
        if (!accessToken) {
          console.warn("⚠️ Mapbox access token not found")
          if (mounted) {
            setMapError("Map service not configured")
            setShowFallback(true)
          }
          return
        }

        // Load CSS
        const cssLink = document.createElement("link")
        cssLink.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
        cssLink.rel = "stylesheet"
        document.head.appendChild(cssLink)

        // Load JS
        const script = document.createElement("script")
        script.src = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"
        script.onload = () => {
          console.log("✅ Mapbox GL JS loaded")
          if (mounted) initializeMap()
        }
        script.onerror = () => {
          console.error("❌ Failed to load Mapbox GL JS")
          if (mounted) {
            setMapError("Failed to load map library")
            setShowFallback(true)
          }
        }
        document.head.appendChild(script)
      } catch (error) {
        console.error("❌ Error loading Mapbox:", error)
        if (mounted) {
          setMapError("Failed to initialize map")
          setShowFallback(true)
        }
      }
    }

    loadMapbox()

    return () => {
      mounted = false
      if (map.current) {
        try {
          map.current.remove()
          map.current = null
        } catch (error) {
          console.warn("Error cleaning up map:", error)
        }
      }
    }
  }, []) // Empty dependency array - only run once

  const initializeMap = useCallback(() => {
    if (!mapContainer.current || map.current || !window.mapboxgl) return

    try {
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      if (!accessToken) {
        setMapError("Mapbox access token not configured")
        setShowFallback(true)
        return
      }

      window.mapboxgl.accessToken = accessToken

      map.current = new window.mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: warehouseLocation ? [warehouseLocation[1], warehouseLocation[0]] : [-79.3832, 43.6532],
        zoom: 11,
        attributionControl: false,
      })

      map.current.addControl(new window.mapboxgl.NavigationControl(), "top-right")

      map.current.on("load", () => {
        console.log("✅ Mapbox map loaded")
        setMapLoaded(true)
        setMapError(null)
      })

      map.current.on("error", (e: any) => {
        console.error("❌ Mapbox error:", e)
        setMapError("Map failed to load")
        setShowFallback(true)
      })
    } catch (error) {
      console.error("❌ Error initializing map:", error)
      setMapError("Failed to create map")
      setShowFallback(true)
    }
  }, [warehouseLocation])

  // Process orders and add markers when orders change or map loads
  useEffect(() => {
    if (!mapLoaded || !map.current || orders.length === 0) return

    let mounted = true

    const processAndAddMarkers = async () => {
      try {
        console.log(`🔍 Processing ${orders.length} orders`)

        // Separate orders with and without coordinates
        const ordersWithCoords = orders.filter((order) => order.coordinates)
        const ordersNeedingGeocode = orders.filter((order) => !order.coordinates && order.delivery_address)

        let allOrders = [...ordersWithCoords]

        // Geocode orders that need it
        if (ordersNeedingGeocode.length > 0) {
          console.log(`🚀 Geocoding ${ordersNeedingGeocode.length} addresses`)

          const addresses = ordersNeedingGeocode.map((order) => order.delivery_address)
          const geocodingResults = await geocodingService.geocodeBatch(addresses)

          const geocodedOrders = ordersNeedingGeocode.map((order) => {
            const result = geocodingResults.find((r) => r.address === order.delivery_address)
            if (result && result.coordinates) {
              return { ...order, coordinates: result.coordinates }
            }
            return order
          })

          allOrders = [...ordersWithCoords, ...geocodedOrders]
        }

        if (mounted) {
          setProcessedOrders(allOrders)
          await addMarkersToMap(allOrders)
        }
      } catch (error) {
        console.error("❌ Error processing orders:", error)
        if (mounted) {
          toast({
            title: "Geocoding Error",
            description: "Some addresses could not be processed.",
            variant: "destructive",
          })
        }
      }
    }

    processAndAddMarkers()

    return () => {
      mounted = false
    }
  }, [orders, mapLoaded, toast]) // Only depend on orders and mapLoaded

  const addMarkersToMap = useCallback(
    async (ordersWithCoords: Order[]) => {
      if (!map.current || !window.mapboxgl) return

      console.log(`🗺️ Adding ${ordersWithCoords.length} markers to map`)

      // Clear existing markers
      markersRef.current.forEach((marker) => {
        try {
          marker.remove()
        } catch (error) {
          console.warn("Error removing marker:", error)
        }
      })
      markersRef.current = []

      const bounds = new window.mapboxgl.LngLatBounds()
      let markersAdded = 0

      // Add warehouse marker
      if (warehouseLocation) {
        try {
          const warehouseEl = document.createElement("div")
          warehouseEl.className = "warehouse-marker"
          warehouseEl.innerHTML = `
          <div style="
            width: 40px;
            height: 40px;
            background: #1e40af;
            border: 3px solid white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
            </svg>
          </div>
        `

          const warehouseMarker = new window.mapboxgl.Marker(warehouseEl)
            .setLngLat([warehouseLocation[1], warehouseLocation[0]])
            .setPopup(
              new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 12px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">🏢 ${warehouseName}</h3>
                <p style="margin: 0; font-size: 12px; color: #6b7280;">Distribution Center</p>
              </div>
            `),
            )
            .addTo(map.current)

          markersRef.current.push(warehouseMarker)
          bounds.extend([warehouseLocation[1], warehouseLocation[0]])
        } catch (error) {
          console.warn("Error adding warehouse marker:", error)
        }
      }

      // Add order markers
      ordersWithCoords.forEach((order, index) => {
        if (!order.coordinates) return

        const [lat, lng] = order.coordinates

        // Validate coordinates
        if (isNaN(lat) || isNaN(lng) || lat < 40 || lat > 50 || lng < -85 || lng > -70) {
          console.warn(`Invalid coordinates for order ${order.order_number}: [${lat}, ${lng}]`)
          return
        }

        try {
          const orderEl = document.createElement("div")
          orderEl.className = "order-marker"

          const priorityColors = {
            urgent: "#ef4444",
            high: "#f97316",
            normal: "#3b82f6",
            low: "#6b7280",
          }

          const color = priorityColors[order.priority] || priorityColors.normal
          const size = order.priority === "urgent" ? 32 : 28

          orderEl.innerHTML = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            font-weight: bold;
            color: white;
            font-size: 11px;
          ">
            ${index + 1}
          </div>
        `

          const orderMarker = new window.mapboxgl.Marker(orderEl)
            .setLngLat([lng, lat])
            .setPopup(
              new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 12px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">
                  #${order.order_number}
                </h3>
                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 500;">${order.customer_name}</p>
                <p style="margin: 0 0 8px 0; font-size: 11px; color: #6b7280;">${order.delivery_address}</p>
                <div style="display: flex; gap: 4px; margin-bottom: 8px;">
                  <span style="
                    padding: 2px 6px;
                    font-size: 9px;
                    border-radius: 4px;
                    background: ${color}20;
                    color: ${color};
                    font-weight: 600;
                    text-transform: uppercase;
                  ">${order.priority}</span>
                  <span style="
                    padding: 2px 6px;
                    font-size: 9px;
                    border-radius: 4px;
                    background: #10b98120;
                    color: #10b981;
                    font-weight: 600;
                    text-transform: uppercase;
                  ">${order.status}</span>
                </div>
                <p style="margin: 0; font-size: 10px; color: #059669;">
                  📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}
                </p>
              </div>
            `),
            )
            .addTo(map.current)

          orderEl.addEventListener("click", () => {
            if (onOrderClick) {
              onOrderClick(order.id)
            }
          })

          markersRef.current.push(orderMarker)
          bounds.extend([lng, lat])
          markersAdded++
        } catch (error) {
          console.warn(`Error adding marker for order ${order.order_number}:`, error)
        }
      })

      // Add driver markers
      driverLocations.forEach((driver) => {
        try {
          const driverEl = document.createElement("div")
          driverEl.className = "driver-marker"
          driverEl.innerHTML = `
          <div style="
            width: 36px;
            height: 36px;
            background: #10b981;
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
          ">
            <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
            </svg>
          </div>
        `

          const driverMarker = new window.mapboxgl.Marker(driverEl)
            .setLngLat([driver.location[1], driver.location[0]])
            .setPopup(
              new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 12px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #059669;">🚛 ${driver.name}</h3>
                <p style="margin: 0 0 4px 0; font-size: 12px;">${driver.orders} active orders</p>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">Status: ${driver.status}</p>
              </div>
            `),
            )
            .addTo(map.current)

          markersRef.current.push(driverMarker)
          bounds.extend([driver.location[1], driver.location[0]])
        } catch (error) {
          console.warn(`Error adding driver marker for ${driver.name}:`, error)
        }
      })

      console.log(`✅ Added ${markersAdded} order markers to map`)

      // Fit map to show all markers
      if (!bounds.isEmpty()) {
        try {
          map.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15,
          })
        } catch (error) {
          console.warn("Error fitting bounds:", error)
        }
      }
    },
    [warehouseLocation, warehouseName, onOrderClick, driverLocations],
  )

  const optimizeRoute = useCallback(async () => {
    if (!processedOrders.length || processedOrders.length < 2) {
      toast({
        title: "Route Optimization",
        description: "At least 2 orders with coordinates are required.",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)

    try {
      console.log(`🚀 Starting route optimization for ${processedOrders.length} orders`)

      const validOrders = processedOrders.filter((order) => order.coordinates)

      if (validOrders.length < 2) {
        throw new Error("Not enough orders with valid coordinates")
      }

      console.log(`📍 Found ${validOrders.length} orders with coordinates`)

      const waypoints = validOrders.map((order, index) => ({
        coordinates: order.coordinates!,
        name: `Stop ${index + 1}: ${order.customer_name}`,
        address: order.delivery_address,
      }))

      if (warehouseLocation) {
        waypoints.unshift({
          coordinates: warehouseLocation,
          name: warehouseName,
          address: "Warehouse",
        })
      }

      console.log(`🎯 Optimizing route with ${waypoints.length} waypoints`)

      const requestBody = {
        waypoints,
        options: {
          profile: "driving",
          source: "first",
          destination: "last",
          roundtrip: false,
        },
      }

      console.log("📤 Sending optimization request:", JSON.stringify(requestBody, null, 2))

      const response = await fetch("/api/optimize-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log(`📥 Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ API response error:", errorText)
        throw new Error(`API returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log("✅ Optimization result:", result)

      if (!result.success || !result.data) {
        throw new Error(result.error || "Invalid response format")
      }

      setOptimizedRoute(result.data)

      toast({
        title: "Route Optimized Successfully!",
        description: `Distance: ${(result.data.distance / 1000).toFixed(1)}km, Time: ${Math.round(result.data.duration / 60)}min`,
      })
    } catch (error) {
      console.error("❌ Route optimization error:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      toast({
        title: "Route Optimization Failed",
        description: `Error: ${errorMessage}. Please check your Mapbox configuration.`,
        variant: "destructive",
      })
    } finally {
      setIsOptimizing(false)
    }
  }, [processedOrders, warehouseLocation, warehouseName, toast])

  const toggleView = () => {
    setShowFallback(!showFallback)
  }

  // Fallback list view
  if (showFallback || mapError) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              {title} - List View
            </CardTitle>
            <div className="flex items-center gap-2">
              {processedOrders.length > 0 && <Badge variant="outline">{processedOrders.length} orders</Badge>}
              {!mapError && (
                <Button variant="outline" size="sm" onClick={toggleView}>
                  <MapPin className="h-4 w-4 mr-1" />
                  Map View
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4" style={{ height }}>
            {mapError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Map Error: {mapError}</span>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {processedOrders.length > 0 ? (
                processedOrders.map((order, index) => (
                  <div
                    key={order.id}
                    className="p-3 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer"
                    onClick={() => onOrderClick?.(order.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">#{order.order_number}</span>
                      <Badge className="text-xs bg-blue-100 text-blue-800">{order.priority}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{order.customer_name}</p>
                    <p className="text-xs text-gray-500">{order.delivery_address}</p>
                    {order.coordinates && (
                      <p className="text-xs text-green-600">
                        📍 {order.coordinates[0].toFixed(4)}, {order.coordinates[1].toFixed(4)}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No orders to display</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {processedOrders.length > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Target className="h-3 w-3 mr-1" />
                {processedOrders.length} locations
              </Badge>
            )}
            {driverLocations.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                <Navigation className="h-3 w-3 mr-1" />
                {driverLocations.length} drivers
              </Badge>
            )}
            {showRouteOptimization && processedOrders.length >= 2 && (
              <Button variant="outline" size="sm" onClick={optimizeRoute} disabled={isOptimizing}>
                <Zap className={`h-4 w-4 mr-1 ${isOptimizing ? "animate-spin" : ""}`} />
                {isOptimizing ? "Optimizing..." : "Optimize Route"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={toggleView}>
              <List className="h-4 w-4 mr-1" />
              List View
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div ref={mapContainer} className="w-full rounded-lg overflow-hidden" style={{ height }} />
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
        </div>
        {optimizedRoute && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <Route className="h-4 w-4" />
              Route Optimized
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-green-700">{(optimizedRoute.distance / 1000).toFixed(1)}km</div>
                <div className="text-green-600 text-xs">Distance</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-700">{Math.round(optimizedRoute.duration / 60)}min</div>
                <div className="text-blue-600 text-xs">Time</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-700">{optimizedRoute.waypoints.length}</div>
                <div className="text-purple-600 text-xs">Stops</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default MapboxMap
