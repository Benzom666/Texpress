interface Coordinates {
  latitude: number
  longitude: number
}

interface GeocodingResult {
  coordinates: Coordinates
  formatted_address: string
  confidence: number
}

export class GeocodingService {
  private mapboxToken: string | undefined

  constructor() {
    // Only access environment variables on the server side
    this.mapboxToken = typeof window === "undefined" ? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN : undefined
  }

  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    try {
      // Try Mapbox geocoding first if token is available
      if (this.mapboxToken) {
        return await this.geocodeWithMapbox(address)
      }

      // Fallback to coordinate generation
      return this.generateFallbackCoordinates(address)
    } catch (error) {
      console.error("Geocoding error:", error)
      return this.generateFallbackCoordinates(address)
    }
  }

  private async geocodeWithMapbox(address: string): Promise<GeocodingResult | null> {
    try {
      const encodedAddress = encodeURIComponent(address)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${this.mapboxToken}&limit=1`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [longitude, latitude] = feature.center

        return {
          coordinates: { latitude, longitude },
          formatted_address: feature.place_name,
          confidence: feature.relevance || 0.8,
        }
      }

      return null
    } catch (error) {
      console.error("Mapbox geocoding failed:", error)
      throw error
    }
  }

  private generateFallbackCoordinates(address: string): GeocodingResult {
    // Generate coordinates based on address hash for consistency
    const hash = this.simpleHash(address)

    // Toronto area coordinates (approximate bounds)
    const torontoCenter = { lat: 43.6532, lng: -79.3832 }
    const radius = 0.1 // Roughly 10km radius

    // Use hash to generate consistent coordinates within Toronto area
    const latOffset = ((hash % 1000) / 1000 - 0.5) * radius * 2
    const lngOffset = (((hash * 7) % 1000) / 1000 - 0.5) * radius * 2

    return {
      coordinates: {
        latitude: torontoCenter.lat + latOffset,
        longitude: torontoCenter.lng + lngOffset,
      },
      formatted_address: address,
      confidence: 0.5, // Lower confidence for generated coordinates
    }
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  async batchGeocode(addresses: string[]): Promise<(GeocodingResult | null)[]> {
    const results: (GeocodingResult | null)[] = []

    // Process in batches to avoid rate limiting
    const batchSize = 5
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize)
      const batchPromises = batch.map((address) => this.geocodeAddress(address))
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches
      if (i + batchSize < addresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return results
  }

  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude)
    const dLon = this.toRadians(coord2.longitude - coord1.longitude)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) *
        Math.cos(this.toRadians(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }
}

export const geocodingService = new GeocodingService()
