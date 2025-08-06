"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  coordinates?: [number, number]
  status: string
  priority: string
}

interface Route {
  id: string
  coordinates: [number, number][]
  color?: string
}

interface MapboxMapProps {
  orders?: Order[]
  routes?: Route[]
  center?: [number, number]
  zoom?: number
  height?: string
  className?: string
}

export function MapboxMap({ 
  orders = [], 
  routes = [], 
  center = [-79.3832, 43.6532], 
  zoom = 10, 
  height = '400px',
  className = ''
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [mapboxLoaded, setMapboxLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Dynamically import mapbox-gl to avoid SSR issues
    const loadMapbox = async () => {
      try {
        const mapboxgl = await import('mapbox-gl')
        
        if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
          throw new Error('Mapbox access token is not configured')
        }

        mapboxgl.default.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

        if (map.current) return // Initialize map only once

        if (!mapContainer.current) return

        map.current = new mapboxgl.default.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: center,
          zoom: zoom
        })

        map.current.on('load', () => {
          setMapboxLoaded(true)
          addOrderMarkers()
          addRoutes()
        })

        map.current.on('error', (e: any) => {
          console.error('Mapbox error:', e)
          setError('Failed to load map')
        })

      } catch (err) {
        console.error('Failed to load Mapbox:', err)
        setError(err instanceof Error ? err.message : 'Failed to load map')
      }
    }

    loadMapbox()

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [center, zoom])

  useEffect(() => {
    if (mapboxLoaded && map.current) {
      addOrderMarkers()
      addRoutes()
    }
  }, [orders, routes, mapboxLoaded])

  const addOrderMarkers = async () => {
    if (!map.current || !mapboxLoaded) return

    try {
      const mapboxgl = await import('mapbox-gl')

      // Clear existing markers
      const existingMarkers = document.querySelectorAll('.order-marker')
      existingMarkers.forEach(marker => marker.remove())

      orders.forEach(order => {
        if (!order.coordinates) return

        const statusColors = {
          pending: '#fbbf24',
          assigned: '#3b82f6',
          picked_up: '#8b5cf6',
          in_transit: '#06b6d4',
          delivered: '#10b981',
          failed: '#ef4444',
          cancelled: '#6b7280'
        }

        const color = statusColors[order.status as keyof typeof statusColors] || '#6b7280'

        // Create marker element
        const markerElement = document.createElement('div')
        markerElement.className = 'order-marker'
        markerElement.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        `

        // Create popup
        const popup = new mapboxgl.default.Popup({ offset: 25 })
          .setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${order.customer_name}</h3>
              <p class="text-sm text-gray-600">${order.delivery_address}</p>
              <p class="text-xs mt-1">
                <span class="inline-block w-2 h-2 rounded-full mr-1" style="background-color: ${color}"></span>
                ${order.status.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          `)

        // Add marker to map
        new mapboxgl.default.Marker(markerElement)
          .setLngLat(order.coordinates)
          .setPopup(popup)
          .addTo(map.current)
      })
    } catch (err) {
      console.error('Failed to add order markers:', err)
    }
  }

  const addRoutes = async () => {
    if (!map.current || !mapboxLoaded) return

    try {
      routes.forEach((route, index) => {
        const sourceId = `route-${route.id || index}`
        const layerId = `route-layer-${route.id || index}`

        // Remove existing route if it exists
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId)
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId)
        }

        // Add route source
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

        // Add route layer
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
            'line-width': 3,
            'line-opacity': 0.8
          }
        })
      })
    } catch (err) {
      console.error('Failed to add routes:', err)
    }
  }

  if (error) {
    return (
      <Card className={`p-4 ${className}`} style={{ height }}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </Card>
    )
  }

  return (
    <Card className={className} style={{ height }}>
      <div
        ref={mapContainer}
        className="w-full h-full rounded-lg"
        style={{ minHeight: height }}
      />
      {!mapboxLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </Card>
  )
}

// Named export
export { MapboxMap as default }

// Default export
export default MapboxMap
