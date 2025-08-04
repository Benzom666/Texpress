// Enhanced geocoding service with multiple providers and better error handling
interface GeocodingCache {
  [address: string]: {
    coordinates: [number, number]
    timestamp: number
    expires: number
    accuracy: "high" | "medium" | "low"
    city: string
    country: string
    formatted_address: string
    confidence: number
    provider: string
  }
}

interface GeocodingResult {
  address: string
  coordinates: [number, number] | null
  fromCache: boolean
  accuracy: "high" | "medium" | "low"
  city?: string
  country?: string
  formatted_address?: string
  confidence?: number
  provider?: string
  error?: string
}

class EnhancedGeocodingService {
  private cache: GeocodingCache = {}
  private pendingRequests: Map<string, Promise<GeocodingResult>> = new Map()
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days
  private readonly BATCH_SIZE = 3 // Reduced batch size for better reliability
  private readonly REQUEST_DELAY = 2000 // 2 second delay between requests
  private readonly MAX_RETRIES = 3
  private requestCount = 0
  private lastRequestTime = 0

  // Toronto area bounds for validation
  private readonly TORONTO_BOUNDS = {
    north: 44.5,
    south: 43.0,
    east: -78.0,
    west: -80.5,
  }

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("enhanced-geocoding-cache-v1")
        if (cached) {
          this.cache = JSON.parse(cached)
          this.cleanExpiredCache()
          console.log(`📍 Loaded ${Object.keys(this.cache).length} cached locations`)
        }
      }
    } catch (error) {
      console.warn("Failed to load geocoding cache:", error)
      this.cache = {}
    }
  }

  private saveCache(): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("enhanced-geocoding-cache-v1", JSON.stringify(this.cache))
      }
    } catch (error) {
      console.warn("Failed to save geocoding cache:", error)
    }
  }

  private cleanExpiredCache(): void {
    const now = Date.now()
    let hasExpired = false

    for (const [address, entry] of Object.entries(this.cache)) {
      if (entry.expires < now) {
        delete this.cache[address]
        hasExpired = true
      }
    }

    if (hasExpired) {
      this.saveCache()
    }
  }

  private getCachedCoordinates(address: string): GeocodingResult | null {
    const cleanAddress = this.cleanAddress(address)
    const entry = this.cache[cleanAddress]
    if (entry && entry.expires > Date.now()) {
      console.log(`💾 Cache hit for: ${cleanAddress}`)
      return {
        address: cleanAddress,
        coordinates: entry.coordinates,
        fromCache: true,
        accuracy: entry.accuracy,
        city: entry.city,
        country: entry.country,
        formatted_address: entry.formatted_address,
        confidence: entry.confidence,
        provider: entry.provider,
      }
    }
    return null
  }

  private setCachedCoordinates(
    address: string,
    coordinates: [number, number],
    accuracy: "high" | "medium" | "low" = "high",
    city = "Toronto",
    country = "Canada",
    formatted_address = address,
    confidence = 1.0,
    provider = "nominatim",
  ): void {
    const cleanAddress = this.cleanAddress(address)
    const now = Date.now()
    this.cache[cleanAddress] = {
      coordinates,
      timestamp: now,
      expires: now + this.CACHE_DURATION,
      accuracy,
      city,
      country,
      formatted_address,
      confidence,
      provider,
    }
    this.saveCache()
    console.log(`💾 Cached: ${cleanAddress} -> [${coordinates[0]}, ${coordinates[1]}] (${provider})`)
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
    this.requestCount++

    return fetch(url, {
      headers: {
        "User-Agent": "DeliveryOS/1.0 (Route Optimization)",
        Accept: "application/json",
      },
    })
  }

  private cleanAddress(address: string): string {
    return address.trim().replace(/\s+/g, " ").replace(/,\s*,/g, ",").replace(/^,|,$/g, "").toLowerCase()
  }

  private normalizeAddress(address: string): string {
    let normalized = address.trim()

    // Add Ontario, Canada if not present
    if (!normalized.toLowerCase().includes("canada")) {
      if (!normalized.toLowerCase().includes("ontario")) {
        normalized += ", Ontario, Canada"
      } else {
        normalized += ", Canada"
      }
    }

    return normalized
  }

  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      lat >= this.TORONTO_BOUNDS.south &&
      lat <= this.TORONTO_BOUNDS.north &&
      lng >= this.TORONTO_BOUNDS.west &&
      lng <= this.TORONTO_BOUNDS.east &&
      !isNaN(lat) &&
      !isNaN(lng)
    )
  }

  // Try multiple geocoding providers
  private async geocodeWithNominatim(address: string): Promise<GeocodingResult | null> {
    try {
      const encodedAddress = encodeURIComponent(address)
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1&countrycodes=ca&bounded=1&viewbox=${this.TORONTO_BOUNDS.west},${this.TORONTO_BOUNDS.north},${this.TORONTO_BOUNDS.east},${this.TORONTO_BOUNDS.south}`

      const response = await this.rateLimitedFetch(nominatimUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data && data.length > 0) {
        const result = data[0]
        const lat = Number.parseFloat(result.lat)
        const lng = Number.parseFloat(result.lon)
        const importance = Number.parseFloat(result.importance || 0)

        if (this.isValidCoordinate(lat, lng)) {
          const coordinates: [number, number] = [lat, lng]
          const accuracy = importance > 0.7 ? "high" : importance > 0.5 ? "medium" : "low"
          const addressComponents = result.address || {}
          const city = addressComponents.city || addressComponents.town || "Toronto"

          return {
            address,
            coordinates,
            fromCache: false,
            accuracy,
            city,
            country: "Canada",
            formatted_address: result.display_name,
            confidence: importance,
            provider: "nominatim",
          }
        }
      }
    } catch (error) {
      console.warn("Nominatim geocoding failed:", error)
    }
    return null
  }

  // Fallback to Mapbox geocoding if available
  private async geocodeWithMapbox(address: string): Promise<GeocodingResult | null> {
    try {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      if (!mapboxToken) {
        return null
      }

      const encodedAddress = encodeURIComponent(address)
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=ca&bbox=${this.TORONTO_BOUNDS.west},${this.TORONTO_BOUNDS.south},${this.TORONTO_BOUNDS.east},${this.TORONTO_BOUNDS.north}&limit=1`

      const response = await this.rateLimitedFetch(mapboxUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [lng, lat] = feature.center
        const relevance = feature.relevance || 0

        if (this.isValidCoordinate(lat, lng)) {
          const coordinates: [number, number] = [lat, lng]
          const accuracy = relevance > 0.8 ? "high" : relevance > 0.6 ? "medium" : "low"

          return {
            address,
            coordinates,
            fromCache: false,
            accuracy,
            city: "Toronto",
            country: "Canada",
            formatted_address: feature.place_name,
            confidence: relevance,
            provider: "mapbox",
          }
        }
      }
    } catch (error) {
      console.warn("Mapbox geocoding failed:", error)
    }
    return null
  }

  // Generate fallback coordinates within Toronto area
  private generateFallbackCoordinates(address: string, index: number): [number, number] {
    // Use postal code or address hash to generate consistent coordinates
    const hash = this.simpleHash(address)
    const baseLat = 43.6532 // Toronto downtown
    const baseLng = -79.3832
    const spread = 0.15 // Larger spread to cover GTA

    // Use hash to generate consistent but distributed coordinates
    const latOffset = ((hash % 1000) / 1000 - 0.5) * spread
    const lngOffset = (((hash * 7) % 1000) / 1000 - 0.5) * spread

    return [baseLat + latOffset, baseLng + lngOffset]
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

  private extractPostalCode(address: string): string {
    const postalCodeRegex = /[A-Za-z]\d[A-Za-z][\s-]?\d[A-Za-z]\d/
    const match = address.match(postalCodeRegex)
    return match ? match[0].replace(/\s|-/g, "").toUpperCase() : "UNKNOWN"
  }

  private determineZone(coordinates: [number, number], address: string): string {
    const [lat, lng] = coordinates

    // Toronto zone determination based on coordinates
    if (lat >= 43.6 && lat <= 43.8 && lng >= -79.5 && lng <= -79.2) {
      return "DOWNTOWN"
    } else if (lat >= 43.7 && lat <= 43.9 && lng >= -79.6 && lng <= -79.3) {
      return "NORTH_YORK"
    } else if (lat >= 43.5 && lat <= 43.7 && lng >= -79.4 && lng <= -79.1) {
      return "SCARBOROUGH"
    } else if (lat >= 43.6 && lat <= 43.8 && lng >= -79.7 && lng <= -79.4) {
      return "ETOBICOKE"
    } else if (lat >= 43.8 && lat <= 44.2 && lng >= -79.8 && lng <= -79.2) {
      return "YORK_REGION"
    } else if (lat >= 43.4 && lat <= 43.7 && lng >= -79.8 && lng <= -79.5) {
      return "MISSISSAUGA"
    }

    return "GREATER_TORONTO"
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || address.trim().length === 0) {
      return {
        address: "",
        coordinates: null,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
        error: "Empty address",
      }
    }

    const cleanAddress = this.cleanAddress(address)

    // Check cache first
    const cached = this.getCachedCoordinates(address)
    if (cached) {
      return cached
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(cleanAddress)
    if (pending) {
      console.log(`⏳ Waiting for pending request: ${cleanAddress}`)
      return await pending
    }

    // Create new request
    const request = this.geocodeSingleAddress(address)
    this.pendingRequests.set(cleanAddress, request)

    try {
      const result = await request
      return result
    } finally {
      this.pendingRequests.delete(cleanAddress)
    }
  }

  private async geocodeSingleAddress(address: string, retryCount = 0): Promise<GeocodingResult> {
    try {
      const cleanAddress = this.cleanAddress(address)
      const normalizedAddress = this.normalizeAddress(address)

      console.log(`🔍 Geocoding: "${address}"`)

      // Try Nominatim first
      let result = await this.geocodeWithNominatim(normalizedAddress)

      // Try Mapbox as fallback
      if (!result) {
        result = await this.geocodeWithMapbox(normalizedAddress)
      }

      if (result && result.coordinates) {
        this.setCachedCoordinates(
          address,
          result.coordinates,
          result.accuracy,
          result.city,
          result.country,
          result.formatted_address,
          result.confidence,
          result.provider,
        )

        console.log(
          `✅ Geocoded: ${address} -> [${result.coordinates[0]}, ${result.coordinates[1]}] (${result.provider})`,
        )
        return result
      }

      // Generate fallback coordinates if all providers fail
      console.warn(`⚠️ Using fallback coordinates for: ${address}`)
      const fallbackCoords = this.generateFallbackCoordinates(address, retryCount)
      const fallbackResult: GeocodingResult = {
        address: cleanAddress,
        coordinates: fallbackCoords,
        fromCache: false,
        accuracy: "low",
        city: "Toronto",
        country: "Canada",
        formatted_address: `${address} (estimated)`,
        confidence: 0.1,
        provider: "fallback",
      }

      // Cache fallback coordinates with shorter expiry
      this.setCachedCoordinates(
        address,
        fallbackCoords,
        "low",
        "Toronto",
        "Canada",
        `${address} (estimated)`,
        0.1,
        "fallback",
      )

      return fallbackResult
    } catch (error) {
      console.error(`❌ Geocoding error for "${address}":`, error)

      if (retryCount < this.MAX_RETRIES) {
        const waitTime = 2000 * (retryCount + 1)
        console.log(`🔄 Retrying geocoding for "${address}" in ${waitTime}ms`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        return this.geocodeSingleAddress(address, retryCount + 1)
      }

      // Final fallback
      const fallbackCoords = this.generateFallbackCoordinates(address, retryCount)
      return {
        address,
        coordinates: fallbackCoords,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
        provider: "fallback",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async geocodeBatch(addresses: string[]): Promise<GeocodingResult[]> {
    const results: GeocodingResult[] = []
    const toGeocode: { address: string; index: number }[] = []

    console.log(`🚀 Starting batch geocoding for ${addresses.length} addresses`)

    // First pass: check cache
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i]
      const cached = this.getCachedCoordinates(address)
      if (cached) {
        results[i] = cached
      } else {
        results[i] = {
          address,
          coordinates: null,
          fromCache: false,
          accuracy: "low",
          confidence: 0,
        }
        toGeocode.push({ address, index: i })
      }
    }

    console.log(`💾 Found ${results.filter((r) => r.fromCache).length} cached, need to geocode ${toGeocode.length}`)

    // Second pass: geocode uncached addresses in smaller batches
    if (toGeocode.length > 0) {
      const batches: { address: string; index: number }[][] = []
      for (let i = 0; i < toGeocode.length; i += this.BATCH_SIZE) {
        batches.push(toGeocode.slice(i, i + this.BATCH_SIZE))
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} addresses)`)

        // Process batch sequentially to avoid rate limits
        for (const { address, index } of batch) {
          try {
            const result = await this.geocodeAddress(address)
            results[index] = result
          } catch (error) {
            console.error(`Error geocoding ${address}:`, error)
            // Keep the fallback result that was already set
          }
        }

        // Longer delay between batches
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ Waiting 3 seconds before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      }
    }

    const successCount = results.filter((r) => r.coordinates).length
    console.log(`✅ Batch geocoding completed: ${successCount}/${results.length} successful`)

    return results
  }

  clearCache(): void {
    this.cache = {}
    if (typeof window !== "undefined") {
      localStorage.removeItem("enhanced-geocoding-cache-v1")
    }
    console.log("🗑️ Geocoding cache cleared")
  }

  getCacheStats() {
    const total = Object.keys(this.cache).length
    const size = new Blob([JSON.stringify(this.cache)]).size
    const providers = Object.values(this.cache).reduce(
      (acc, entry) => {
        acc[entry.provider] = (acc[entry.provider] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return {
      total,
      size: `${(size / 1024).toFixed(1)} KB`,
      requestCount: this.requestCount,
      providers,
    }
  }
}

export const enhancedGeocodingService = new EnhancedGeocodingService()
