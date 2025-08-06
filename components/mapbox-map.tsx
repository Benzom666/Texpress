"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'

interface MapboxMapProps {
  orders?: Array<{
    id: string
    delivery_address: string
    coordinates?: [number, number]
    status: string
  }>
  routes?: Array<{
    id: string
    coordinates: [number, number][]
  }>
  height?: string
  className?: string
  onOrderClick?: (orderId: string) => void
}

export function MapboxMap({ 
  orders = [], 
  routes = [], 
  height = "400px", 
  className = "",
  onOrderClick 
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    // Check if we're in the browser and if Mapbox GL JS is available
    if (typeof window === 'undefined') return

    const initializeMap = async () => {
      try {
        // Dynamically import Mapbox GL JS
        const mapboxgl = await import('mapbox-gl')
        
        // Check if access token is available
        const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
        if (!accessToken) {
          setMapError('Mapbox access token not configured')
          return
        }

        mapboxgl.default.accessToken = accessToken

        if (map.current) return // Initialize map only once

        map.current = new mapboxgl.default.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [-74.5, 40], // Default center
          zoom: 9
        })

        map.current.on('load', () => {
          setMapLoaded(true)
          
          // Add markers for orders
          orders.forEach((order) => {
            if (order.coordinates) {
              const marker = new mapboxgl.default.Marker()
                .setLngLat(order.coordinates)
                .setPopup(
                  new mapboxgl.default.Popup().setHTML(
                    `<div>
                      <h3>${order.delivery_address}</h3>
                      <p>Status: ${order.status}</p>
                    </div>`
                  )
                )
                .addTo(map.current)

              // Add click handler if provided
              if (onOrderClick) {
                marker.getElement().addEventListener('click', () => {
                  onOrderClick(order.id)
                })
              }
            }
          })

          // Add route lines
          routes.forEach((route, index) => {
            if (route.coordinates.length > 1) {
              map.current.addSource(`route-${index}`, {
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
                id: `route-${index}`,
                type: 'line',
                source: `route-${index}`,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': '#3b82f6',
                  'line-width': 3
                }
              })
            }
          })

          // Fit map to show all markers
          if (orders.length > 0) {
            const coordinates = orders
              .filter(order => order.coordinates)
              .map(order => order.coordinates!)

            if (coordinates.length > 0) {
              const bounds = new mapboxgl.default.LngLatBounds()
              coordinates.forEach(coord => bounds.extend(coord))
              map.current.fitBounds(bounds, { padding: 50 })
            }
          }
        })

        map.current.on('error', (e: any) => {
          console.error('Mapbox error:', e)
          setMapError('Failed to load map')
        })

      } catch (error) {
        console.error('Error initializing Mapbox:', error)
        setMapError('Mapbox GL JS not available')
      }
    }

    initializeMap()

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [orders, routes, onOrderClick])

  if (mapError) {
    return (
      <Card className={`p-4 ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground">Map unavailable</p>
            <p className="text-sm text-muted-foreground mt-1">{mapError}</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <div 
        ref={mapContainer} 
        style={{ height }}
        className="w-full rounded-lg"
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}
    </Card>
  )
}

// Named export

// Default export
export default MapboxMap
