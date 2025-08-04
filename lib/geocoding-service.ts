// Enhanced geocoding service with comprehensive error handling and optimization
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
}

class GeocodingService {
  private cache: GeocodingCache = {}
  private pendingRequests: Map<string, Promise<GeocodingResult>> = new Map()
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days
  private readonly BATCH_SIZE = 5 // Reasonable batch size
  private readonly REQUEST_DELAY = 1000 // 1 second delay between requests
  private readonly MAX_RETRIES = 2
  private requestCount = 0
  private lastRequestTime = 0

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("geocoding-cache-v7")
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
        localStorage.setItem("geocoding-cache-v7", JSON.stringify(this.cache))
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
    }
    this.saveCache()
    console.log(`💾 Cached: ${cleanAddress} -> [${coordinates[0]}, ${coordinates[1]}]`)
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

    return fetch(url, {
      headers: {
        "User-Agent": "DeliveryOS/1.0",
        Accept: "application/json",
      },
    })
  }

  private cleanAddress(address: string): string {
    return address.trim().replace(/\s+/g, " ").replace(/,\s*,/g, ",").replace(/^,|,$/g, "").toLowerCase()
  }

  private normalizeAddress(address: string): string {
    let normalized = address.trim()

    // Add Canada if not present
    if (!normalized.toLowerCase().includes("canada") && !normalized.toLowerCase().includes("ontario")) {
      normalized += ", Ontario, Canada"
    }

    return normalized
  }

  private isValidCoordinate(lat: number, lng: number): boolean {
    // Bounds for Greater Toronto Area and surrounding regions
    return lat >= 43.0 && lat <= 45.0 && lng >= -80.5 && lng <= -78.5 && !isNaN(lat) && !isNaN(lng)
  }

  private async geocodeSingleAddress(address: string, retryCount = 0): Promise<GeocodingResult> {
    try {
      const cleanAddress = this.cleanAddress(address)
      const normalizedAddress = this.normalizeAddress(address)

      console.log(`🔍 Geocoding: "${address}"`)

      // Try Nominatim (free and reliable)
      try {
        const encodedAddress = encodeURIComponent(normalizedAddress)
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1&countrycodes=ca&bounded=1&viewbox=-80.5,45.0,-78.5,43.0`

        const response = await this.rateLimitedFetch(nominatimUrl)

        if (!response.ok) {
          if (response.status === 429 && retryCount < this.MAX_RETRIES) {
            const waitTime = 2000 * (retryCount + 1)
            console.log(`⏳ Rate limited, waiting ${waitTime}ms`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            return this.geocodeSingleAddress(address, retryCount + 1)
          }
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

            const geocodingResult: GeocodingResult = {
              address: cleanAddress,
              coordinates,
              fromCache: false,
              accuracy,
              city,
              country: "Canada",
              formatted_address: result.display_name,
              confidence: importance,
            }

            this.setCachedCoordinates(address, coordinates, accuracy, city, "Canada", result.display_name, importance)

            console.log(`✅ Geocoded: ${address} -> [${lat}, ${lng}]`)
            return geocodingResult
          }
        }
      } catch (error) {
        console.warn("Nominatim geocoding failed:", error)
      }

      console.warn(`❌ No valid coordinates found for: ${address}`)
      return {
        address: cleanAddress,
        coordinates: null,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
      }
    } catch (error) {
      console.error(`❌ Geocoding error for "${address}":`, error)

      if (retryCount < this.MAX_RETRIES) {
        const waitTime = 1000 * (retryCount + 1)
        console.log(`🔄 Retrying geocoding for "${address}" in ${waitTime}ms`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        return this.geocodeSingleAddress(address, retryCount + 1)
      }

      return {
        address,
        coordinates: null,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
      }
    }
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || address.trim().length === 0) {
      return {
        address: "",
        coordinates: null,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
      }
    }

    const cleanAddress = this.cleanAddress(address)

    // Check cache first
    const cached = this.getCachedCoordinates(address)
    if (cached) {
      return cached
    }

    // Check if request is already pending to prevent duplicates
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

    // Second pass: geocode uncached addresses in batches
    if (toGeocode.length > 0) {
      const batches: { address: string; index: number }[][] = []
      for (let i = 0; i < toGeocode.length; i += this.BATCH_SIZE) {
        batches.push(toGeocode.slice(i, i + this.BATCH_SIZE))
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length}`)

        // Process batch sequentially to avoid rate limits
        for (const { address, index } of batch) {
          try {
            const result = await this.geocodeAddress(address)
            results[index] = result
          } catch (error) {
            console.error(`Error geocoding ${address}:`, error)
          }
        }

        // Delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
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
      localStorage.removeItem("geocoding-cache-v7")
    }
    console.log("🗑️ Geocoding cache cleared")
  }

  getCacheStats() {
    const total = Object.keys(this.cache).length
    const size = new Blob([JSON.stringify(this.cache)]).size

    return {
      total,
      size: `${(size / 1024).toFixed(1)} KB`,
      requestCount: this.requestCount,
    }
  }
}

export const geocodingService = new GeocodingService()
