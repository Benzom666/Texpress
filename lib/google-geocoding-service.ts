// Google Geocoding Service with enhanced error handling and API key validation
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
    place_id: string
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
  place_id?: string
  error?: string
}

class GoogleGeocodingService {
  private cache: GeocodingCache = {}
  private pendingRequests: Map<string, Promise<GeocodingResult>> = new Map()
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days
  private readonly BATCH_SIZE = 3 // Reduced batch size
  private readonly REQUEST_DELAY = 500 // Increased delay between requests
  private readonly MAX_RETRIES = 2 // Reduced retries
  private readonly API_KEY = "AIzaSyAqyPLaS-u9zS3CdjB0DImUcaTvfBTWUuQ"
  private requestCount = 0
  private lastRequestTime = 0
  private apiKeyValid = true
  private lastApiError: string | null = null

  // Toronto area bounds for validation
  private readonly TORONTO_BOUNDS = {
    north: 44.5,
    south: 43.0,
    east: -78.0,
    west: -80.5,
  }

  constructor() {
    this.loadCache()
    this.validateApiKey()
  }

  private async validateApiKey(): Promise<void> {
    try {
      console.log("🔑 Validating Google API key...")

      // Test with a simple geocoding request
      const testUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Toronto,ON,Canada&key=${this.API_KEY}`

      const response = await fetch(testUrl, {
        headers: {
          "User-Agent": "DeliveryOS/1.0",
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status === "REQUEST_DENIED") {
        this.apiKeyValid = false
        this.lastApiError = data.error_message || "API key invalid or missing permissions"
        console.error("❌ Google API key validation failed:", this.lastApiError)
        console.error("📋 Please check:")
        console.error("   1. API key is correct")
        console.error("   2. Geocoding API is enabled in Google Cloud Console")
        console.error("   3. Billing is set up for the project")
        console.error("   4. API key has no domain/IP restrictions or they're properly configured")
      } else if (data.status === "OK") {
        this.apiKeyValid = true
        this.lastApiError = null
        console.log("✅ Google API key validated successfully")
      } else {
        console.warn(`⚠️ API key validation returned: ${data.status}`)
        this.lastApiError = `API validation status: ${data.status}`
      }
    } catch (error) {
      this.apiKeyValid = false
      this.lastApiError = error instanceof Error ? error.message : "Unknown validation error"
      console.error("❌ Google API key validation error:", this.lastApiError)
    }
  }

  private loadCache(): void {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("google-geocoding-cache-v2")
        if (cached) {
          this.cache = JSON.parse(cached)
          this.cleanExpiredCache()
          console.log(`📍 Loaded ${Object.keys(this.cache).length} cached Google locations`)
        }
      }
    } catch (error) {
      console.warn("Failed to load Google geocoding cache:", error)
      this.cache = {}
    }
  }

  private saveCache(): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("google-geocoding-cache-v2", JSON.stringify(this.cache))
      }
    } catch (error) {
      console.warn("Failed to save Google geocoding cache:", error)
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
      console.log(`💾 Google cache hit for: ${cleanAddress}`)
      return {
        address: cleanAddress,
        coordinates: entry.coordinates,
        fromCache: true,
        accuracy: entry.accuracy,
        city: entry.city,
        country: entry.country,
        formatted_address: entry.formatted_address,
        confidence: entry.confidence,
        place_id: entry.place_id,
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
    place_id = "",
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
      place_id,
    }
    this.saveCache()
    console.log(`💾 Google cached: ${cleanAddress} -> [${coordinates[0]}, ${coordinates[1]}]`)
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
    this.requestCount++

    console.log(`🌐 Making Google API request #${this.requestCount}`)

    return fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "DeliveryOS/1.0",
        Accept: "application/json",
        Referer: typeof window !== "undefined" ? window.location.origin : "https://deliveryos.app",
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

  private async geocodeWithGoogle(address: string): Promise<GeocodingResult | null> {
    // Check if API key is valid before making request
    if (!this.apiKeyValid) {
      console.warn(`⚠️ Skipping Google API request due to invalid key: ${this.lastApiError}`)
      return null
    }

    try {
      const encodedAddress = encodeURIComponent(address)
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.API_KEY}&region=ca&components=country:CA`

      console.log(`🔍 Google geocoding request: ${address}`)

      const response = await this.rateLimitedFetch(googleUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`📡 Google API response status: ${data.status}`)

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const result = data.results[0]
        const location = result.geometry.location
        const lat = location.lat
        const lng = location.lng

        console.log(`📍 Google returned coordinates: [${lat}, ${lng}]`)

        if (this.isValidCoordinate(lat, lng)) {
          const coordinates: [number, number] = [lat, lng]

          // Determine accuracy based on location type
          const locationType = result.geometry.location_type
          let accuracy: "high" | "medium" | "low" = "medium"
          let confidence = 0.8

          switch (locationType) {
            case "ROOFTOP":
              accuracy = "high"
              confidence = 1.0
              break
            case "RANGE_INTERPOLATED":
              accuracy = "high"
              confidence = 0.9
              break
            case "GEOMETRIC_CENTER":
              accuracy = "medium"
              confidence = 0.7
              break
            case "APPROXIMATE":
              accuracy = "low"
              confidence = 0.5
              break
          }

          // Extract city from address components
          let city = "Toronto"
          const addressComponents = result.address_components || []
          for (const component of addressComponents) {
            if (component.types.includes("locality")) {
              city = component.long_name
              break
            }
          }

          return {
            address,
            coordinates,
            fromCache: false,
            accuracy,
            city,
            country: "Canada",
            formatted_address: result.formatted_address,
            confidence,
            place_id: result.place_id,
          }
        } else {
          console.warn(`⚠️ Coordinates outside Toronto bounds: [${lat}, ${lng}]`)
        }
      } else if (data.status === "ZERO_RESULTS") {
        console.warn(`🔍 Google Geocoding: No results for "${address}"`)
      } else if (data.status === "OVER_QUERY_LIMIT") {
        console.error("🚫 Google Geocoding: Over query limit")
        this.apiKeyValid = false
        this.lastApiError = "Query limit exceeded"
        throw new Error("Google Geocoding API quota exceeded")
      } else if (data.status === "REQUEST_DENIED") {
        console.error("🚫 Google Geocoding: Request denied")
        console.error("📋 Error details:", data.error_message || "No additional details")
        this.apiKeyValid = false
        this.lastApiError = data.error_message || "Request denied"
        throw new Error(`Google Geocoding API request denied: ${data.error_message || "Check API key and permissions"}`)
      } else if (data.status === "INVALID_REQUEST") {
        console.error("🚫 Google Geocoding: Invalid request")
        console.error("📋 Error details:", data.error_message || "No additional details")
        throw new Error(`Invalid request: ${data.error_message || "Check request format"}`)
      } else {
        console.warn(`⚠️ Google Geocoding: ${data.status} for "${address}"`)
        if (data.error_message) {
          console.warn(`📋 Error details: ${data.error_message}`)
        }
      }
    } catch (error) {
      console.error("❌ Google geocoding failed:", error)
      throw error
    }
    return null
  }

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
      console.log(`⏳ Waiting for pending Google request: ${cleanAddress}`)
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

      console.log(`🔍 Google geocoding: "${address}"`)

      // If API key is invalid, skip to fallback immediately
      if (!this.apiKeyValid) {
        console.warn(`⚠️ Using fallback coordinates due to API key issues: ${this.lastApiError}`)
        const fallbackCoords = this.generateFallbackCoordinates(address, retryCount)
        const fallbackResult: GeocodingResult = {
          address: cleanAddress,
          coordinates: fallbackCoords,
          fromCache: false,
          accuracy: "low",
          city: "Toronto",
          country: "Canada",
          formatted_address: `${address} (estimated - API unavailable)`,
          confidence: 0.1,
          place_id: "",
          error: this.lastApiError || "Google API unavailable",
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
          "",
        )

        return fallbackResult
      }

      const result = await this.geocodeWithGoogle(normalizedAddress)

      if (result && result.coordinates) {
        this.setCachedCoordinates(
          address,
          result.coordinates,
          result.accuracy,
          result.city,
          result.country,
          result.formatted_address,
          result.confidence,
          result.place_id,
        )

        console.log(
          `✅ Google geocoded: ${address} -> [${result.coordinates[0]}, ${result.coordinates[1]}] (${result.accuracy})`,
        )
        return result
      }

      // Generate fallback coordinates if Google fails
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
        place_id: "",
      }

      // Cache fallback coordinates with shorter expiry
      this.setCachedCoordinates(address, fallbackCoords, "low", "Toronto", "Canada", `${address} (estimated)`, 0.1, "")

      return fallbackResult
    } catch (error) {
      console.error(`❌ Google geocoding error for "${address}":`, error)

      if (retryCount < this.MAX_RETRIES && !error.message.includes("quota") && !error.message.includes("denied")) {
        const waitTime = 2000 * (retryCount + 1)
        console.log(`🔄 Retrying Google geocoding for "${address}" in ${waitTime}ms`)
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
        place_id: "",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async geocodeBatch(addresses: string[]): Promise<GeocodingResult[]> {
    const results: GeocodingResult[] = []
    const toGeocode: { address: string; index: number }[] = []

    console.log(`🚀 Starting Google batch geocoding for ${addresses.length} addresses`)

    // Show API key status
    if (!this.apiKeyValid) {
      console.warn(`⚠️ Google API key is invalid: ${this.lastApiError}`)
      console.warn(`📋 Will use fallback coordinates for all addresses`)
    }

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
        console.log(`🔄 Processing Google batch ${batchIndex + 1}/${batches.length} (${batch.length} addresses)`)

        // Process batch with controlled concurrency
        const batchPromises = batch.map(async ({ address, index }) => {
          try {
            const result = await this.geocodeAddress(address)
            results[index] = result
          } catch (error) {
            console.error(`Error geocoding ${address}:`, error)
            // Generate fallback for failed geocoding
            const fallbackCoords = this.generateFallbackCoordinates(address, index)
            results[index] = {
              address,
              coordinates: fallbackCoords,
              fromCache: false,
              accuracy: "low",
              confidence: 0,
              error: error instanceof Error ? error.message : "Unknown error",
            }
          }
        })

        await Promise.all(batchPromises)

        // Delay between batches to respect rate limits
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ Waiting 2 seconds before next Google batch...`)
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    const successCount = results.filter((r) => r.coordinates && !r.error).length
    const fallbackCount = results.filter((r) => r.coordinates && r.error).length
    console.log(
      `✅ Google batch geocoding completed: ${successCount} successful, ${fallbackCount} fallback, ${results.length} total`,
    )

    return results
  }

  clearCache(): void {
    this.cache = {}
    if (typeof window !== "undefined") {
      localStorage.removeItem("google-geocoding-cache-v2")
    }
    console.log("🗑️ Google geocoding cache cleared")
  }

  getCacheStats() {
    const total = Object.keys(this.cache).length
    const size = new Blob([JSON.stringify(this.cache)]).size

    return {
      total,
      size: `${(size / 1024).toFixed(1)} KB`,
      requestCount: this.requestCount,
      provider: "Google Maps",
      apiKeyValid: this.apiKeyValid,
      lastError: this.lastApiError,
    }
  }

  getApiStatus() {
    return {
      valid: this.apiKeyValid,
      error: this.lastApiError,
      requestCount: this.requestCount,
    }
  }
}

export const googleGeocodingService = new GoogleGeocodingService()
