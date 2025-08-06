interface GraphHopperConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

interface VehicleType {
  type_id: string
  profile: string
  capacity: number[]
  speed_factor?: number
  service_time_factor?: number
}

interface OptimizationJob {
  vehicles: Vehicle[]
  services: Service[]
  objectives?: Objective[]
  configuration?: Configuration
}

interface Vehicle {
  vehicle_id: string
  type_id: string
  start_address: Address
  end_address?: Address
  earliest_start?: number
  latest_end?: number
  skills?: string[]
  max_distance?: number
  max_driving_time?: number
  max_jobs?: number
}

interface Service {
  id: string
  type?: string
  address: Address
  duration?: number
  size?: number[]
  required_skills?: string[]
  allowed_vehicles?: string[]
  priority?: number
  time_windows?: TimeWindow[]
}

interface Address {
  location_id?: string
  lon: number
  lat: number
  street_hint?: string
}

interface TimeWindow {
  earliest: number
  latest: number
}

interface Objective {
  type: string
  value?: string
}

interface Configuration {
  routing?: {
    calc_points?: boolean
    consider_traffic?: boolean
    network_data_provider?: string
  }
}

interface OptimizationResponse {
  job_id: string
  status: string
  waiting_time_in_queue: number
  processing_time: number
  solution?: Solution
  message?: string
}

interface Solution {
  costs: number
  distance: number
  time: number
  transport_time: number
  completion_time: number
  max_operation_time: number
  waiting_time: number
  service_duration: number
  preparation_time: number
  no_vehicles: number
  no_unassigned: number
  routes: Route[]
  unassigned: UnassignedJob[]
}

interface Route {
  vehicle_id: string
  distance: number
  transport_time: number
  completion_time: number
  waiting_time: number
  service_duration: number
  preparation_time: number
  activities: Activity[]
}

interface Activity {
  type: string
  id?: string
  location_id?: string
  address?: Address
  arr_time?: number
  end_time?: number
  end_date_time?: string
  arr_date_time?: string
  waiting_time?: number
  preparation_time?: number
  distance?: number
  driving_time?: number
  load_before?: number[]
  load_after?: number[]
}

interface UnassignedJob {
  id: string
  code: number
  reason: string
}

export class GraphHopperClient {
  private config: GraphHopperConfig
  private baseUrl: string

  constructor(config: GraphHopperConfig) {
    this.config = {
      timeout: 30000,
      baseUrl: "https://graphhopper.com/api/1",
      ...config,
    }
    this.baseUrl = this.config.baseUrl!

    if (!this.config.apiKey) {
      throw new Error("GraphHopper API key is required")
    }
  }

  /**
   * Submit an optimization job to GraphHopper
   */
  async submitOptimization(job: OptimizationJob): Promise<string> {
    try {
      console.log("🚀 Submitting optimization job to GraphHopper")

      const response = await fetch(`${this.baseUrl}/vrp/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(job),
        signal: AbortSignal.timeout(this.config.timeout!),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GraphHopper API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()

      if (!result.job_id) {
        throw new Error("No job ID returned from GraphHopper")
      }

      console.log(`✅ Optimization job submitted: ${result.job_id}`)
      return result.job_id
    } catch (error) {
      console.error("❌ GraphHopper optimization submission failed:", error)
      throw error
    }
  }

  /**
   * Get optimization job status and results
   */
  async getOptimizationResult(jobId: string): Promise<OptimizationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/vrp/solution/${jobId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(this.config.timeout!),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GraphHopper API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result: OptimizationResponse = await response.json()
      return result
    } catch (error) {
      console.error("❌ GraphHopper result fetch failed:", error)
      throw error
    }
  }

  /**
   * Wait for optimization job to complete
   */
  async waitForOptimization(jobId: string, maxWaitTime = 300000): Promise<OptimizationResponse> {
    const startTime = Date.now()
    const pollInterval = 2000 // 2 seconds

    console.log(`⏳ Waiting for optimization job ${jobId} to complete...`)

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getOptimizationResult(jobId)

      if (result.status === "finished") {
        console.log(`✅ Optimization completed in ${result.processing_time}ms`)
        return result
      }

      if (result.status === "failed") {
        throw new Error(`Optimization failed: ${result.message || "Unknown error"}`)
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Optimization timeout after ${maxWaitTime}ms`)
  }

  /**
   * Optimize routes with automatic job submission and waiting
   */
  async optimizeRoutes(job: OptimizationJob): Promise<Solution> {
    try {
      // Submit optimization job
      const jobId = await this.submitOptimization(job)

      // Wait for completion
      const result = await this.waitForOptimization(jobId)

      if (!result.solution) {
        throw new Error("No solution returned from GraphHopper")
      }

      return result.solution
    } catch (error) {
      console.error("❌ Route optimization failed:", error)
      throw error
    }
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(lat: number, lon: number): boolean {
    return !isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && lat !== 0 && lon !== 0 // Exclude null island
  }

  /**
   * Create a vehicle configuration
   */
  createVehicle(
    vehicleId: string,
    typeId: string,
    startLocation: [number, number],
    endLocation?: [number, number],
    options: {
      earliestStart?: Date
      latestEnd?: Date
      maxDistance?: number
      maxDrivingTime?: number
      maxJobs?: number
      skills?: string[]
    } = {},
  ): Vehicle {
    const vehicle: Vehicle = {
      vehicle_id: vehicleId,
      type_id: typeId,
      start_address: {
        lat: startLocation[0],
        lon: startLocation[1],
      },
    }

    if (endLocation) {
      vehicle.end_address = {
        lat: endLocation[0],
        lon: endLocation[1],
      }
    }

    if (options.earliestStart) {
      vehicle.earliest_start = Math.floor(options.earliestStart.getTime() / 1000)
    }

    if (options.latestEnd) {
      vehicle.latest_end = Math.floor(options.latestEnd.getTime() / 1000)
    }

    if (options.maxDistance) {
      vehicle.max_distance = options.maxDistance
    }

    if (options.maxDrivingTime) {
      vehicle.max_driving_time = options.maxDrivingTime
    }

    if (options.maxJobs) {
      vehicle.max_jobs = options.maxJobs
    }

    if (options.skills) {
      vehicle.skills = options.skills
    }

    return vehicle
  }

  /**
   * Create a service (delivery) configuration
   */
  createService(
    serviceId: string,
    location: [number, number],
    options: {
      duration?: number
      size?: number[]
      priority?: number
      timeWindows?: Array<{ earliest: Date; latest: Date }>
      requiredSkills?: string[]
      allowedVehicles?: string[]
    } = {},
  ): Service {
    const service: Service = {
      id: serviceId,
      type: "service",
      address: {
        lat: location[0],
        lon: location[1],
      },
    }

    if (options.duration) {
      service.duration = options.duration
    }

    if (options.size) {
      service.size = options.size
    }

    if (options.priority) {
      service.priority = options.priority
    }

    if (options.timeWindows) {
      service.time_windows = options.timeWindows.map((tw) => ({
        earliest: Math.floor(tw.earliest.getTime() / 1000),
        latest: Math.floor(tw.latest.getTime() / 1000),
      }))
    }

    if (options.requiredSkills) {
      service.required_skills = options.requiredSkills
    }

    if (options.allowedVehicles) {
      service.allowed_vehicles = options.allowedVehicles
    }

    return service
  }

  /**
   * Create optimization job configuration
   */
  createOptimizationJob(
    vehicles: Vehicle[],
    services: Service[],
    options: {
      objectives?: Array<{ type: string; value?: string }>
      calcPoints?: boolean
      considerTraffic?: boolean
    } = {},
  ): OptimizationJob {
    const job: OptimizationJob = {
      vehicles,
      services,
    }

    if (options.objectives) {
      job.objectives = options.objectives
    } else {
      // Default objectives
      job.objectives = [
        { type: "min", value: "completion_time" },
        { type: "min", value: "transport_time" },
      ]
    }

    job.configuration = {
      routing: {
        calc_points: options.calcPoints ?? true,
        consider_traffic: options.considerTraffic ?? false,
        network_data_provider: "openstreetmap",
      },
    }

    return job
  }

  /**
   * Get account information and credits
   */
  async getAccountInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/info`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to get account info: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("❌ Failed to get GraphHopper account info:", error)
      throw error
    }
  }
}

// Export types for use in other modules
export type {
  GraphHopperConfig,
  VehicleType,
  OptimizationJob,
  Vehicle,
  Service,
  Address,
  TimeWindow,
  OptimizationResponse,
  Solution,
  Route,
  Activity,
  UnassignedJob,
}
