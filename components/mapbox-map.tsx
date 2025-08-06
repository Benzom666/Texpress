"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, MapPin } from 'lucide-react'

// Mock mapbox-gl for environments where it's not available
let mapboxgl: any = null
if (typeof window !== 'undefined') {
  try {
    mapboxgl = require('mapbox-gl')
    if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    }
  } catch (error) {
    console.warn('Mapbox GL JS not available:', error)
  }
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: string
  status: string
  coordinates?: [number, number]
}

interface MapboxMapProps {
  orders?: Order[]
  center?: [number, number]
  zoom?: number
  style?: string
  className?: string
  height?: string
  title?: string
  markers?: Array<{
    id: string
    coordinates: [number, number]
    title?: string
    description?: string
    color?: string
  }>
  routes?: Array<{
    id: string
    coordinates: [number, number][]
    color?: string
    width?: number
  }>
  optimizedRoute?: [number, number][]
  driverLocation?: [number, number]
  onOrderClick?: (orderId: string) => void
  onMarkerClick?: (markerId: string) => void
  onMapLoad?: (map: any) => void
}

function MapboxMap({
  orders = [],
  center = [-74.006, 40.7128], // Default to NYC
  zoom = 12,
  style = 'mapbox://styles/mapbox/streets-v11',
  className = '',
  height = '400px',
  title,
  markers = [],
  routes = [],
  optimizedRoute,
  driverLocation,
  onOrderClick,
  onMarkerClick,
  onMapLoad
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markersRef = useRef<{ [key: string]: any }>({})
  const [mapError, setMapError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!mapboxgl) {
      setMapError('Mapbox GL JS not available')
      return
    }

    if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
      setMapError('Mapbox access token not configured')
      return
    }

    if (map.current) return // Initialize map only once

    if (mapContainer.current) {
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: style,
          center: center,
          zoom: zoom,
          attributionControl: false
        })

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
        map.current.addControl(new mapboxgl.AttributionControl({
          compact: true
        }))

        map.current.on('load', () => {
          setIsLoaded(true)
          if (onMapLoad && map.current) {
            onMapLoad(map.current)
          }
          addMarkersAndRoutes()
        })

        map.current.on('error', (e: any) => {
          console.error('Mapbox error:', e)
          setMapError('Failed to load map')
        })
      } catch (error) {
        console.error('Error initializing map:', error)
        setMapError('Failed to initialize map')
      }
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [center, zoom, style, onMapLoad])

  // Update markers when they change
  useEffect(() => {
    if (!map.current || !isLoaded || !mapboxgl) return

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker: any) => marker.remove())
    markersRef.current = {}

    // Add new markers
    markers.forEach(markerData => {
      try {
        const el = document.createElement('div')
        el.className = 'marker'
        el.style.backgroundColor = markerData.color || '#3b82f6'
        el.style.width = '20px'
        el.style.height = '20px'
        el.style.borderRadius = '50%'
        el.style.border = '2px solid white'
        el.style.cursor = 'pointer'
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

        const marker = new mapboxgl.Marker(el)
          .setLngLat(markerData.coordinates)

        if (markerData.title || markerData.description) {
          const popup = new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-2">
                ${markerData.title ? `<h3 class="font-semibold text-sm">${markerData.title}</h3>` : ''}
                ${markerData.description ? `<p class="text-xs text-gray-600 mt-1">${markerData.description}</p>` : ''}
              </div>
            `)
          marker.setPopup(popup)
        }

        if (onMarkerClick) {
          el.addEventListener('click', () => onMarkerClick(markerData.id))
        }

        marker.addTo(map.current!)
        markersRef.current[markerData.id] = marker
      } catch (error) {
        console.error('Error adding marker:', error)
      }
    })
  }, [markers, isLoaded, onMarkerClick])

  // Update routes when they change
  useEffect(() => {
    if (!map.current || !isLoaded || !mapboxgl) return

    // Remove existing route sources and layers
    routes.forEach((route, index) => {
      const sourceId = `route-${index}`
      const layerId = `route-layer-${index}`
      
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId)
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }
    })

    // Add new routes
    routes.forEach((route, index) => {
      if (map.current && route.coordinates.length > 1) {
        const sourceId = `route-${index}`
        const layerId = `route-layer-${index}`

        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates
            }
          }
        })

        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': route.color || '#3b82f6',
            'line-width': route.width || 3
          }
        })
      }
    })
  }, [routes, isLoaded])

  const addMarkersAndRoutes = () => {
    if (!map.current || !mapboxgl) return

    try {
      // Add driver location marker if provided
      if (driverLocation) {
        const driverEl = document.createElement('div')
        driverEl.className = 'driver-marker'
        driverEl.style.cssText = `
          width: 30px;
          height: 30px;
          background: #10b981;
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: white;
          font-weight: bold;
        `
        driverEl.innerHTML = '🚚'

        new mapboxgl.Marker(driverEl)
          .setLngLat([driverLocation[1], driverLocation[0]])
          .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Driver Location</strong><br/>Current position</div>'))
          .addTo(map.current)
      }

      // Add order markers
      orders.forEach((order, index) => {
        if (!order.coordinates) return

        const el = document.createElement('div')
        el.className = 'order-marker'
        
        const priorityColors = {
          urgent: '#ef4444',
          high: '#f97316',
          normal: '#10b981',
          low: '#6b7280'
        }
        
        const color = priorityColors[order.priority as keyof typeof priorityColors] || '#10b981'
        
        el.style.cssText = `
          width: 24px;
          height: 24px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: white;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `
        el.innerHTML = (index + 1).toString()

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong>${order.customer_name}</strong><br/>
            <small>${order.order_number}</small><br/>
            <small>${order.delivery_address}</small><br/>
            <span style="color: ${color}; font-weight: bold;">${order.priority.toUpperCase()}</span>
          </div>
        `)

        const marker = new mapboxgl.Marker(el)
          .setLngLat([order.coordinates[1], order.coordinates[0]])
          .setPopup(popup)
          .addTo(map.current)

        el.addEventListener('click', () => {
          if (onOrderClick) {
            onOrderClick(order.id)
          }
        })
      })

      // Add optimized route if provided
      if (optimizedRoute && optimizedRoute.length > 1) {
        const routeCoordinates = optimizedRoute.map(coord => [coord[1], coord[0]])
        
        map.current.addSource('optimized-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoordinates
            }
          }
        })

        map.current.addLayer({
          id: 'optimized-route',
          type: 'line',
          source: 'optimized-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 4,
            'line-opacity': 0.8
          }
        })
      }
    } catch (error) {
      console.error('Error adding markers and routes:', error)
    }
  }

  if (mapError) {
    return (
      <Card className={`bg-slate-900 border-slate-800 ${className}`}>
        <CardContent className="p-6">
          {title && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
          )}
          <Alert className="border-red-800 bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">
              {mapError}
            </AlertDescription>
          </Alert>
          <div className="mt-4 p-8 bg-slate-800 rounded-lg text-center">
            <MapPin className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">Map Unavailable</h3>
            <p className="text-slate-400 text-sm">
              Showing {orders.length} orders in list format
            </p>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {orders.map((order, index) => (
                <div key={order.id} className="flex items-center justify-between p-2 bg-slate-700 rounded text-sm">
                  <span className="text-white">{index + 1}. {order.customer_name}</span>
                  <span className="text-slate-400">{order.priority}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-slate-900 border-slate-800 ${className}`}>
      <CardContent className="p-0">
        {title && (
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
        )}
        <div className="relative">
          <div
            ref={mapContainer}
            style={{ height }}
            className="w-full rounded-b-lg overflow-hidden"
          />
          {!isLoaded && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Named export
export { MapboxMap }

// Default export
export default MapboxMap
