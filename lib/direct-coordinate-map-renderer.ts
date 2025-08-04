// Direct Coordinate Map Renderer
// Renders maps using latitude/longitude coordinates without any geocoding

import * as google from "google-maps"

export interface MapRenderOptions {
  containerId: string
  warehouseCoordinates: [number, number]
  routes: Array<{
    route_number: number
    orders: Array<{
      id: string
      coordinates: [number, number]
      customer_name: string
      order_number: string
      stop_number?: number
    }>
    color: string
  }>
  mapStyle?: "roadmap" | "satellite" | "hybrid" | "terrain"
  showTraffic?: boolean
  showRouteLines?: boolean
  showStopNumbers?: boolean
}

export class DirectCoordinateMapRenderer {
  private map: google.maps.Map | null = null
  private markers: google.maps.Marker[] = []
  private polylines: google.maps.Polyline[] = []
  private infoWindows: google.maps.InfoWindow[] = []

  /**
   * Initialize map with direct coordinates (no geocoding)
   */
  async initializeMap(options: MapRenderOptions): Promise<void> {
    console.log("🗺️ Initializing map with direct coordinates...")

    const mapContainer = document.getElementById(options.containerId)
    if (!mapContainer) {
      throw new Error(`Map container with ID '${options.containerId}' not found`)
    }

    // Clear existing map elements
    this.clearMap()

    // Create map centered on warehouse coordinates
    this.map = new google.maps.Map(mapContainer, {
      center: {
        lat: options.warehouseCoordinates[0],
        lng: options.warehouseCoordinates[1],
      },
      zoom: 12,
      mapTypeId: options.mapStyle || "roadmap",
      styles: this.getMapStyles(),
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true,
    })

    // Add traffic layer if requested
    if (options.showTraffic) {
      const trafficLayer = new google.maps.TrafficLayer()
      trafficLayer.setMap(this.map)
    }

    // Add warehouse marker
    this.addWarehouseMarker(options.warehouseCoordinates)

    // Add route markers and lines
    if (options.routes && options.routes.length > 0) {
      await this.renderRoutes(options.routes, options)
    }

    // Fit map to show all markers
    this.fitMapToMarkers()

    console.log("✅ Map initialized successfully with direct coordinates")
  }

  /**
   * Add warehouse marker using direct coordinates
   */
  private addWarehouseMarker(coordinates: [number, number]): void {
    if (!this.map) return

    const warehouseMarker = new google.maps.Marker({
      position: {
        lat: coordinates[0],
        lng: coordinates[1],
      },
      map: this.map,
      title: "Warehouse",
      icon: {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(this.getWarehouseIcon()),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 40),
      },
      zIndex: 1000,
    })

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold;">Warehouse</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">
            Distribution Center<br>
            Coordinates: ${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}
          </p>
        </div>
      `,
    })

    warehouseMarker.addListener("click", () => {
      this.closeAllInfoWindows()
      infoWindow.open(this.map, warehouseMarker)
    })

    this.markers.push(warehouseMarker)
    this.infoWindows.push(infoWindow)
  }

  /**
   * Render routes using direct coordinates
   */
  private async renderRoutes(routes: MapRenderOptions["routes"], options: MapRenderOptions): Promise<void> {
    console.log(`🛣️ Rendering ${routes.length} routes with direct coordinates...`)

    for (const route of routes) {
      await this.renderSingleRoute(route, options)
    }
  }

  /**
   * Render a single route using direct coordinates
   */
  private async renderSingleRoute(route: MapRenderOptions["routes"][0], options: MapRenderOptions): Promise<void> {
    if (!this.map || !route.orders || route.orders.length === 0) return

    // Add order markers
    route.orders.forEach((order, index) => {
      this.addOrderMarker(order, route.color, options.showStopNumbers)
    })

    // Add route line if requested
    if (options.showRouteLines) {
      this.addRouteLine(route, options.warehouseCoordinates)
    }
  }

  /**
   * Add order marker using direct coordinates
   */
  private addOrderMarker(
    order: MapRenderOptions["routes"][0]["orders"][0],
    routeColor: string,
    showStopNumbers = true,
  ): void {
    if (!this.map) return

    const marker = new google.maps.Marker({
      position: {
        lat: order.coordinates[0],
        lng: order.coordinates[1],
      },
      map: this.map,
      title: `${order.customer_name} - ${order.order_number}`,
      icon: {
        url:
          "data:image/svg+xml;charset=UTF-8," +
          encodeURIComponent(this.getOrderIcon(routeColor, showStopNumbers ? order.stop_number : undefined)),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32),
      },
    })

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${order.customer_name}</h3>
          <div style="font-size: 12px; line-height: 1.4;">
            <div style="margin-bottom: 4px;"><strong>Order:</strong> ${order.order_number}</div>
            ${order.stop_number ? `<div style="margin-bottom: 4px;"><strong>Stop:</strong> #${order.stop_number}</div>` : ""}
            <div style="margin-bottom: 4px;"><strong>Coordinates:</strong> ${order.coordinates[0].toFixed(6)}, ${order.coordinates[1].toFixed(6)}</div>
          </div>
        </div>
      `,
    })

    marker.addListener("click", () => {
      this.closeAllInfoWindows()
      infoWindow.open(this.map, marker)
    })

    this.markers.push(marker)
    this.infoWindows.push(infoWindow)
  }

  /**
   * Add route line using direct coordinates
   */
  private addRouteLine(route: MapRenderOptions["routes"][0], warehouseCoordinates: [number, number]): void {
    if (!this.map || !route.orders || route.orders.length === 0) return

    // Create path coordinates
    const pathCoordinates: google.maps.LatLng[] = []

    // Start at warehouse
    pathCoordinates.push(new google.maps.LatLng(warehouseCoordinates[0], warehouseCoordinates[1]))

    // Add all order coordinates in sequence
    route.orders.forEach((order) => {
      pathCoordinates.push(new google.maps.LatLng(order.coordinates[0], order.coordinates[1]))
    })

    // Return to warehouse
    pathCoordinates.push(new google.maps.LatLng(warehouseCoordinates[0], warehouseCoordinates[1]))

    // Create polyline
    const routeLine = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: route.color,
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: this.map,
    })

    this.polylines.push(routeLine)
  }

  /**
   * Fit map bounds to show all markers
   */
  private fitMapToMarkers(): void {
    if (!this.map || this.markers.length === 0) return

    const bounds = new google.maps.LatLngBounds()

    this.markers.forEach((marker) => {
      const position = marker.getPosition()
      if (position) {
        bounds.extend(position)
      }
    })

    this.map.fitBounds(bounds)

    // Set minimum zoom level
    google.maps.event.addListenerOnce(this.map, "bounds_changed", () => {
      if (this.map && this.map.getZoom()! > 15) {
        this.map.setZoom(15)
      }
    })
  }

  /**
   * Clear all map elements
   */
  private clearMap(): void {
    // Clear markers
    this.markers.forEach((marker) => marker.setMap(null))
    this.markers = []

    // Clear polylines
    this.polylines.forEach((polyline) => polyline.setMap(null))
    this.polylines = []

    // Clear info windows
    this.infoWindows.forEach((infoWindow) => infoWindow.close())
    this.infoWindows = []
  }

  /**
   * Close all info windows
   */
  private closeAllInfoWindows(): void {
    this.infoWindows.forEach((infoWindow) => infoWindow.close())
  }

  /**
   * Update map with new routes using direct coordinates
   */
  async updateRoutes(routes: MapRenderOptions["routes"], options: Partial<MapRenderOptions> = {}): Promise<void> {
    console.log("🔄 Updating map with new routes...")

    // Clear existing route elements (keep warehouse)
    this.polylines.forEach((polyline) => polyline.setMap(null))
    this.polylines = []

    // Remove order markers (keep warehouse marker)
    const warehouseMarker = this.markers[0] // Assuming first marker is warehouse
    this.markers.slice(1).forEach((marker) => marker.setMap(null))
    this.markers = [warehouseMarker]

    // Close info windows except warehouse
    this.infoWindows.slice(1).forEach((infoWindow) => infoWindow.close())
    this.infoWindows = [this.infoWindows[0]]

    // Render new routes
    if (routes && routes.length > 0) {
      await this.renderRoutes(routes, {
        containerId: "",
        warehouseCoordinates: [0, 0], // Will be overridden
        routes,
        showRouteLines: true,
        showStopNumbers: true,
        ...options,
      })
    }

    // Fit map to new markers
    this.fitMapToMarkers()

    console.log("✅ Map updated successfully")
  }

  /**
   * Get warehouse icon SVG
   */
  private getWarehouseIcon(): string {
    return `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="18" fill="#1f2937" stroke="white" stroke-width="3"/>
        <path d="M20 8L12 14v12h16V14l-8-6z" fill="white"/>
        <rect x="16" y="20" width="8" height="6" fill="#1f2937"/>
      </svg>
    `
  }

  /**
   * Get order icon SVG
   */
  private getOrderIcon(color: string, stopNumber?: number): string {
    return `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
        ${
          stopNumber
            ? `<text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">${stopNumber}</text>`
            : `<circle cx="16" cy="16" r="4" fill="white"/>`
        }
      </svg>
    `
  }

  /**
   * Get custom map styles
   */
  private getMapStyles(): google.maps.MapTypeStyle[] {
    return [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "transit",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
    ]
  }

  /**
   * Destroy map and clean up resources
   */
  destroy(): void {
    this.clearMap()
    this.map = null
  }

  /**
   * Get current map instance
   */
  getMap(): google.maps.Map | null {
    return this.map
  }

  /**
   * Center map on specific coordinates
   */
  centerOnCoordinates(coordinates: [number, number], zoom = 14): void {
    if (!this.map) return

    this.map.setCenter({
      lat: coordinates[0],
      lng: coordinates[1],
    })
    this.map.setZoom(zoom)
  }

  /**
   * Add custom marker at specific coordinates
   */
  addCustomMarker(
    coordinates: [number, number],
    title: string,
    content: string,
    icon?: string,
  ): google.maps.Marker | null {
    if (!this.map) return null

    const marker = new google.maps.Marker({
      position: {
        lat: coordinates[0],
        lng: coordinates[1],
      },
      map: this.map,
      title,
      icon: icon
        ? {
            url: icon,
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 32),
          }
        : undefined,
    })

    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="padding: 8px;">${content}</div>`,
    })

    marker.addListener("click", () => {
      this.closeAllInfoWindows()
      infoWindow.open(this.map, marker)
    })

    this.markers.push(marker)
    this.infoWindows.push(infoWindow)

    return marker
  }
}

export const directCoordinateMapRenderer = new DirectCoordinateMapRenderer()
