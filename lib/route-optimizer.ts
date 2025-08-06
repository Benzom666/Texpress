import { distanceCalculator } from "./distance-calculator"

interface OptimizationResult {
  route: number[]
  totalDistance: number
  totalTime: number
  algorithm: string
  iterations: number
  improvement: number
  estimatedArrivalTimes: Date[]
  trafficAdjustments: number[]
  isValid: boolean
  errors: string[]
}

interface DeliveryWindow {
  start: Date
  end: Date
  priority: "urgent" | "high" | "normal" | "low"
}

interface TrafficCondition {
  segmentIndex: number
  delayFactor: number
  congestionLevel: "light" | "moderate" | "heavy"
}

interface VehicleConstraints {
  maxCapacity: number
  currentLoad: number
  maxDeliveries: number
  workingHours: { start: Date; end: Date }
}

interface DeliveryStop {
  id: string
  coordinates: [number, number]
  timeWindow?: DeliveryWindow
  estimatedServiceTime: number
  packageWeight?: number
  priority: "urgent" | "high" | "normal" | "low"
  specialRequirements?: string[]
}

interface OptimizationWaypoint {
  coordinates: [number, number]
  name?: string
  address?: string
  waypointIndex?: number
}

interface OptimizedRoute {
  waypoints: OptimizationWaypoint[]
  distance: number
  duration: number
  geometry: [number, number][]
  legs: RouteLeg[]
}

interface RouteLeg {
  distance: number
  duration: number
  steps: RouteStep[]
}

interface RouteStep {
  distance: number
  duration: number
  instruction: string
  coordinates: [number, number][]
}

interface RouteOptimizationOptions {
  profile?: "driving" | "walking" | "cycling"
  source?: "first" | "any"
  destination?: "last" | "any"
  roundtrip?: boolean
  annotations?: string[]
}

class RouteOptimizer {
  private readonly MAX_ITERATIONS = 1000
  private readonly IMPROVEMENT_THRESHOLD = 0.001
  private readonly CLUSTER_SIZE_LIMIT = 8
  private readonly TRAFFIC_UPDATE_INTERVAL = 5 * 60 * 1000
  private readonly OPTIMIZATION_TIMEOUT = 30000
  private trafficCache = new Map<string, TrafficCondition>()
  private lastTrafficUpdate = 0
  private accessToken: string

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""
  }

  async optimizeWithOSRM(waypoints: OptimizationWaypoint[]): Promise<OptimizedRoute> {
    const OSRM_API_URL = "http://router.project-osrm.org/trip/v1/driving"
    // Convert waypoints to OSRM format [lng,lat]
    const coordinates = waypoints.map((wp) => `${wp.coordinates[1]},${wp.coordinates[0]}`).join(";")
    const url = `${OSRM_API_URL}/${coordinates}?source=first&destination=last&roundtrip=false&steps=true&geometries=geojson&overview=full`

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`OSRM API error: ${response.status}`)

      const data = await response.json()

      if (data.code !== "Ok" || !data.trips || data.trips.length === 0) {
        throw new Error("No optimized route returned from OSRM")
      }

      const trip = data.trips[0]
      const optimizedWaypoints = data.waypoints.map((wp: any) => {
        const originalWaypoint = waypoints[wp.waypoint_index]
        return {
          coordinates: [wp.location[1], wp.location[0]] as [number, number],
          name: originalWaypoint?.name || `Stop ${wp.waypoint_index + 1}`,
          address: originalWaypoint?.address,
          waypointIndex: wp.waypoint_index,
        }
      })

      return {
        waypoints: optimizedWaypoints,
        distance: trip.distance,
        duration: trip.duration,
        geometry: trip.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]),
        legs: trip.legs.map((leg: any) => ({
          distance: leg.distance,
          duration: leg.duration,
          steps:
            leg.steps?.map((step: any) => ({
              distance: step.distance,
              duration: step.duration,
              instruction: step.maneuver?.instruction || "",
              coordinates:
                step.geometry?.coordinates?.map(
                  (coord: [number, number]) => [coord[1], coord[0]] as [number, number],
                ) || [],
            })) || [],
        })),
      }
    } catch (error) {
      console.error("OSRM optimization failed:", error)
      // Fallback to a simple sequential route
      return this.createFallbackOptimization(waypoints)
    }
  }

  private createFallbackOptimization(waypoints: OptimizationWaypoint[]): OptimizedRoute {
    const legs: RouteLeg[] = []
    let totalDistance = 0
    let totalDuration = 0

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i]
      const to = waypoints[i + 1]
      const distance = distanceCalculator.calculateRealWorldDistance(from.coordinates, to.coordinates) * 1000 // to meters
      const duration = distance / 13.89 // assume 50 km/h avg speed

      legs.push({
        distance,
        duration,
        steps: [
          {
            distance,
            duration,
            instruction: `Head to ${to.name || "next stop"}`,
            coordinates: [from.coordinates, to.coordinates],
          },
        ],
      })
      totalDistance += distance
      totalDuration += duration
    }

    return {
      waypoints,
      distance: totalDistance,
      duration: totalDuration,
      geometry: waypoints.map((wp) => wp.coordinates),
      legs,
    }
  }

  async optimizeDeliveryRoute(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    vehicleConstraints: VehicleConstraints,
    currentTime: Date = new Date(),
  ): Promise<OptimizationResult> {
    const errors: string[] = []

    try {
      const validationResult = this.validateInputs(driverLocation, deliveries, vehicleConstraints)
      if (!validationResult.isValid) {
        return this.createErrorResult(validationResult.errors)
      }

      if (deliveries.length === 0) {
        return this.createEmptyResult()
      }

      const waypoints: OptimizationWaypoint[] = [
        { coordinates: driverLocation, name: "Start" },
        ...deliveries.map((d) => ({
          coordinates: d.coordinates,
          name: d.id,
          address: "", // address not needed for OSRM call
        })),
      ]

      const osrmRoute = await this.optimizeWithOSRM(waypoints)

      // The OSRM route waypoints will be ordered. We need to map them back to original delivery indices.
      const route = osrmRoute.waypoints
        .slice(1)
        .map((wp) => {
          // The name property holds the original delivery ID
          return deliveries.findIndex((d) => d.id === wp.name)
        })
        .filter((index) => index !== -1)

      const estimatedArrivalTimes: Date[] = []
      let currentDateTime = new Date(currentTime)
      for (let i = 0; i < osrmRoute.legs.length; i++) {
        const leg = osrmRoute.legs[i]
        const delivery = deliveries[route[i]]
        currentDateTime = new Date(currentDateTime.getTime() + leg.duration * 1000)
        estimatedArrivalTimes.push(new Date(currentDateTime))
        currentDateTime = new Date(currentDateTime.getTime() + delivery.estimatedServiceTime * 60000)
      }

      return {
        route,
        totalDistance: osrmRoute.distance / 1000, // convert to km
        totalTime: osrmRoute.duration / 60, // convert to minutes
        algorithm: "osrm_trip",
        iterations: 1,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments: route.map(() => 1.0),
        isValid: true,
        errors: [],
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown optimization error")
      return this.createFallbackResult(driverLocation, deliveries, currentTime, errors)
    }
  }

  private validateInputs(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    vehicleConstraints: VehicleConstraints,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    if (!driverLocation || driverLocation.length !== 2 || isNaN(driverLocation[0]) || isNaN(driverLocation[1])) {
      errors.push("Invalid driver location")
    }
    if (!Array.isArray(deliveries) || deliveries.length > 100) {
      errors.push("Invalid deliveries array or too many deliveries")
    }
    if (!vehicleConstraints || vehicleConstraints.maxCapacity <= 0 || vehicleConstraints.currentLoad < 0) {
      errors.push("Invalid vehicle constraints")
    }
    return { isValid: errors.length === 0, errors }
  }

  private validateOptimizationResult(result: OptimizationResult, deliveries: DeliveryStop[]): OptimizationResult {
    const errors: string[] = [...result.errors]
    if (result.route.length !== deliveries.length) {
      errors.push(`Route missing deliveries: expected ${deliveries.length}, got ${result.route.length}`)
    }
    const uniqueIndices = new Set(result.route)
    if (uniqueIndices.size !== result.route.length) {
      errors.push("Route contains duplicate delivery indices")
    }
    return { ...result, isValid: errors.length === 0, errors }
  }

  private async runOptimizationAlgorithms(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    const algorithms = [
      () => this.nearestNeighborOptimization(driverLocation, deliveries, currentTime),
      () => this.timeWindowOptimization(driverLocation, deliveries, currentTime),
    ]
    if (deliveries.length <= this.CLUSTER_SIZE_LIMIT) {
      algorithms.push(() => this.hybridOptimization(driverLocation, deliveries, currentTime))
    }

    const results = await Promise.allSettled(algorithms.map((algo) => algo()))
    const successfulResults = results
      .filter(
        (result): result is PromiseFulfilledResult<OptimizationResult> =>
          result.status === "fulfilled" && result.value.route.length > 0,
      )
      .map((result) => result.value)

    if (successfulResults.length === 0) {
      return this.simpleSequentialOptimization(driverLocation, deliveries, currentTime)
    }

    return successfulResults.reduce((best, current) => (current.totalDistance < best.totalDistance ? current : best))
  }

  private async nearestNeighborOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    if (deliveries.length === 0) return this.createEmptyResult()

    const route: number[] = []
    const visited = new Set<number>()
    let currentLocation = driverLocation
    let totalDistance = 0
    let totalTime = 0
    const estimatedArrivalTimes: Date[] = []
    const trafficAdjustments: number[] = []
    let currentDateTime = new Date(currentTime)

    try {
      let firstStopIndex = -1
      let shortestDistanceToDriver = Number.POSITIVE_INFINITY
      for (let i = 0; i < deliveries.length; i++) {
        const delivery = deliveries[i]
        if (!delivery.coordinates) continue
        try {
          const distanceToDriver = distanceCalculator.calculateRealWorldDistance(driverLocation, delivery.coordinates)
          if (distanceToDriver < shortestDistanceToDriver) {
            shortestDistanceToDriver = distanceToDriver
            firstStopIndex = i
          }
        } catch (error) {
          continue
        }
      }
      if (firstStopIndex === -1) throw new Error("Could not find any valid first stop")

      const firstDelivery = deliveries[firstStopIndex]
      route.push(firstStopIndex)
      visited.add(firstStopIndex)
      const firstTravelTime = await this.calculateDynamicTravelTime(
        currentLocation,
        firstDelivery.coordinates,
        currentDateTime,
      )
      totalDistance += shortestDistanceToDriver
      totalTime += firstTravelTime + firstDelivery.estimatedServiceTime
      currentDateTime = new Date(
        currentDateTime.getTime() + (firstTravelTime + firstDelivery.estimatedServiceTime) * 60000,
      )
      estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - firstDelivery.estimatedServiceTime * 60000))
      trafficAdjustments.push(1.0)
      currentLocation = firstDelivery.coordinates

      while (route.length < deliveries.length) {
        let nearestIndex = -1
        let nearestDistance = Number.POSITIVE_INFINITY
        let nearestTime = 0
        for (let i = 0; i < deliveries.length; i++) {
          if (visited.has(i)) continue
          const delivery = deliveries[i]
          if (!delivery.coordinates) continue
          try {
            const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestIndex = i
              nearestTime = await this.calculateDynamicTravelTime(
                currentLocation,
                delivery.coordinates,
                currentDateTime,
              )
            }
          } catch (error) {
            continue
          }
        }
        if (nearestIndex === -1) break

        const delivery = deliveries[nearestIndex]
        route.push(nearestIndex)
        visited.add(nearestIndex)
        totalDistance += nearestDistance
        totalTime += nearestTime + delivery.estimatedServiceTime
        currentDateTime = new Date(currentDateTime.getTime() + (nearestTime + delivery.estimatedServiceTime) * 60000)
        estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))
        const trafficKey = `${currentLocation[0]},${currentLocation[1]}-${delivery.coordinates[0]},${delivery.coordinates[1]}`
        trafficAdjustments.push(this.trafficCache.get(trafficKey)?.delayFactor || 1.0)
        currentLocation = delivery.coordinates
      }

      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "nearest_neighbor_from_driver",
        iterations: deliveries.length,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      return this.createErrorResult([error instanceof Error ? error.message : "Nearest neighbor optimization failed"])
    }
  }

  private async simpleSequentialOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    if (deliveries.length === 0) return this.createEmptyResult()

    const route: number[] = []
    let totalDistance = 0
    let totalTime = 0
    const estimatedArrivalTimes: Date[] = []
    const trafficAdjustments: number[] = []
    let currentLocation = driverLocation
    let currentDateTime = new Date(currentTime)

    try {
      for (let i = 0; i < deliveries.length; i++) {
        const delivery = deliveries[i]
        if (!delivery.coordinates) continue
        route.push(i)
        const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
        const travelTime = await this.calculateDynamicTravelTime(currentLocation, delivery.coordinates, currentDateTime)
        totalDistance += distance
        totalTime += travelTime + delivery.estimatedServiceTime
        currentDateTime = new Date(currentDateTime.getTime() + (travelTime + delivery.estimatedServiceTime) * 60000)
        estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))
        trafficAdjustments.push(1.0)
        currentLocation = delivery.coordinates
      }
      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "simple_sequential",
        iterations: 1,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      return this.createErrorResult([error instanceof Error ? error.message : "Sequential optimization failed"])
    }
  }

  private async timeWindowOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    try {
      const sortedDeliveries = [...deliveries].sort(
        (a, b) => this.calculateUrgencyScore(b, currentTime) - this.calculateUrgencyScore(a, currentTime),
      )
      const route: number[] = []
      let currentLocation = driverLocation
      let totalDistance = 0
      let totalTime = 0
      const estimatedArrivalTimes: Date[] = []
      const trafficAdjustments: number[] = []
      let currentDateTime = new Date(currentTime)

      for (const delivery of sortedDeliveries) {
        const originalIndex = deliveries.indexOf(delivery)
        const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
        const travelTime = await this.calculateDynamicTravelTime(currentLocation, delivery.coordinates, currentDateTime)
        route.push(originalIndex)
        totalDistance += distance
        totalTime += travelTime + delivery.estimatedServiceTime
        currentDateTime = new Date(currentDateTime.getTime() + (travelTime + delivery.estimatedServiceTime) * 60000)
        estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))
        const trafficKey = `${currentLocation[0]},${currentLocation[1]}-${delivery.coordinates[0]},${delivery.coordinates[1]}`
        trafficAdjustments.push(this.trafficCache.get(trafficKey)?.delayFactor || 1.0)
        currentLocation = delivery.coordinates
      }
      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "time_window",
        iterations: deliveries.length,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      return this.createErrorResult([error instanceof Error ? error.message : "Time window optimization failed"])
    }
  }

  private async hybridOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    try {
      const vehicleConstraints: VehicleConstraints = {
        maxCapacity: 100,
        currentLoad: 0,
        maxDeliveries: deliveries.length,
        workingHours: {
          start: new Date(currentTime.getTime() - 60 * 60 * 1000),
          end: new Date(currentTime.getTime() + 8 * 60 * 60 * 1000),
        },
      }
      const route: number[] = []
      const visited = new Set<number>()
      let currentLocation = driverLocation
      let totalDistance = 0
      let totalTime = 0
      let currentLoad = vehicleConstraints.currentLoad
      const estimatedArrivalTimes: Date[] = []
      const trafficAdjustments: number[] = []
      let currentDateTime = new Date(currentTime)

      while (route.length < deliveries.length) {
        let bestIndex = -1
        let bestScore = -1
        for (let i = 0; i < deliveries.length; i++) {
          if (visited.has(i)) continue
          const delivery = deliveries[i]
          const packageWeight = delivery.packageWeight || 1
          if (currentLoad + packageWeight > vehicleConstraints.maxCapacity) continue
          const score = await this.calculateHybridScore(currentLocation, delivery, currentDateTime, vehicleConstraints)
          if (score > bestScore) {
            bestScore = score
            bestIndex = i
          }
        }
        if (bestIndex !== -1) {
          const delivery = deliveries[bestIndex]
          route.push(bestIndex)
          visited.add(bestIndex)
          const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
          const travelTime = await this.calculateDynamicTravelTime(
            currentLocation,
            delivery.coordinates,
            currentDateTime,
          )
          totalDistance += distance
          totalTime += travelTime + delivery.estimatedServiceTime
          currentLoad += delivery.packageWeight || 1
          currentDateTime = new Date(currentDateTime.getTime() + (travelTime + delivery.estimatedServiceTime) * 60000)
          estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))
          const trafficKey = `${currentLocation[0]},${currentLocation[1]}-${delivery.coordinates[0]},${delivery.coordinates[1]}`
          trafficAdjustments.push(this.trafficCache.get(trafficKey)?.delayFactor || 1.0)
          currentLocation = delivery.coordinates
        } else {
          break
        }
      }
      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "hybrid",
        iterations: deliveries.length,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      return this.createErrorResult([error instanceof Error ? error.message : "Hybrid optimization failed"])
    }
  }

  private async calculateDynamicTravelTime(
    from: [number, number],
    to: [number, number],
    departureTime: Date,
  ): Promise<number> {
    try {
      const baseTime = distanceCalculator.calculateTravelTime(distanceCalculator.calculateRealWorldDistance(from, to))
      const trafficCondition = this.trafficCache.get(`${from[0]},${from[1]}-${to[0]},${to[1]}`)
      if (trafficCondition) return baseTime * trafficCondition.delayFactor

      const hour = departureTime.getHours()
      let timeMultiplier = 1.0
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) timeMultiplier = 1.3
      else if (hour >= 22 || hour <= 6) timeMultiplier = 0.8
      return Math.max(baseTime * timeMultiplier, 1)
    } catch (error) {
      return 15
    }
  }

  private async updateTrafficConditions(driverLocation: [number, number], deliveries: DeliveryStop[]): Promise<void> {
    const now = Date.now()
    if (now - this.lastTrafficUpdate < this.TRAFFIC_UPDATE_INTERVAL) return

    try {
      const allLocations = [driverLocation, ...deliveries.map((d) => d.coordinates)]
      for (let i = 0; i < allLocations.length; i++) {
        for (let j = i + 1; j < allLocations.length; j++) {
          const from = allLocations[i]
          const to = allLocations[j]
          const key = `${from[0]},${from[1]}-${to[0]},${to[1]}`
          const distance = distanceCalculator.calculateRealWorldDistance(from, to)
          let delayFactor = 1.0
          let congestionLevel: "light" | "moderate" | "heavy" = "light"
          if (distance > 10) {
            delayFactor = 1.2 + Math.random() * 0.3
            congestionLevel = "moderate"
          } else if (distance > 5) {
            delayFactor = 1.1 + Math.random() * 0.4
            congestionLevel = Math.random() > 0.7 ? "heavy" : "moderate"
          } else {
            delayFactor = 1.0 + Math.random() * 0.2
          }
          this.trafficCache.set(key, { segmentIndex: i, delayFactor, congestionLevel })
        }
      }
      this.lastTrafficUpdate = now
    } catch (error) {
      throw error
    }
  }

  private filterFeasibleDeliveries(
    deliveries: DeliveryStop[],
    constraints: VehicleConstraints,
    currentTime: Date,
  ): DeliveryStop[] {
    return deliveries.filter((delivery) => {
      try {
        const packageWeight = delivery.packageWeight || 1
        if (constraints.currentLoad + packageWeight > constraints.maxCapacity * 1.2) return false
        const workingHoursBuffer = 2 * 60 * 60 * 1000
        if (
          currentTime < new Date(constraints.workingHours.start.getTime() - workingHoursBuffer) ||
          currentTime > new Date(constraints.workingHours.end.getTime() + workingHoursBuffer)
        )
          return false
        if (delivery.timeWindow) {
          const estimatedArrival = new Date(currentTime.getTime() + 60 * 60000)
          if (estimatedArrival > new Date(delivery.timeWindow.end.getTime() + 2 * 60 * 60000)) return false
        }
        return true
      } catch (error) {
        return true
      }
    })
  }

  private calculateUrgencyScore(delivery: DeliveryStop, currentTime: Date): number {
    let score = 0
    switch (delivery.priority) {
      case "urgent":
        score += 100
        break
      case "high":
        score += 75
        break
      case "normal":
        score += 50
        break
      case "low":
        score += 25
        break
    }
    if (delivery.timeWindow) {
      const hoursToDeadline = (delivery.timeWindow.end.getTime() - currentTime.getTime()) / (1000 * 60 * 60)
      if (hoursToDeadline < 1) score += 50
      else if (hoursToDeadline < 2) score += 30
      else if (hoursToDeadline < 4) score += 15
    }
    return score
  }

  private async calculateHybridScore(
    currentLocation: [number, number],
    delivery: DeliveryStop,
    currentTime: Date,
    constraints: VehicleConstraints,
  ): Promise<number> {
    try {
      const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
      const travelTime = await this.calculateDynamicTravelTime(currentLocation, delivery.coordinates, currentTime)
      let score = 100
      score -= distance * 2
      score -= travelTime * 0.5
      score += this.getPriorityWeight(delivery.priority) * 10
      if (delivery.timeWindow) {
        const estimatedArrival = new Date(currentTime.getTime() + travelTime * 60000)
        if (estimatedArrival <= delivery.timeWindow.end) score += 20
        else score -= 50
      }
      const packageWeight = delivery.packageWeight || 1
      const remainingCapacity = constraints.maxCapacity - constraints.currentLoad
      if (packageWeight <= remainingCapacity * 0.5) score += 10
      return Math.max(score, 0)
    } catch (error) {
      return 50
    }
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case "urgent":
        return 4.0
      case "high":
        return 2.0
      case "normal":
        return 1.0
      case "low":
        return 0.5
      default:
        return 1.0
    }
  }

  private createEmptyResult = (): OptimizationResult => ({
    route: [],
    totalDistance: 0,
    totalTime: 0,
    algorithm: "empty",
    iterations: 0,
    improvement: 0,
    estimatedArrivalTimes: [],
    trafficAdjustments: [],
    isValid: true,
    errors: [],
  })
  private createErrorResult = (errors: string[]): OptimizationResult => ({
    route: [],
    totalDistance: 0,
    totalTime: 0,
    algorithm: "error",
    iterations: 0,
    improvement: 0,
    estimatedArrivalTimes: [],
    trafficAdjustments: [],
    isValid: false,
    errors,
  })
  private createFallbackResult = (
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
    errors: string[],
  ): OptimizationResult => ({
    route: deliveries.map((_, index) => index),
    totalDistance: 0,
    totalTime: deliveries.length * 30,
    algorithm: "fallback_sequential",
    iterations: 1,
    improvement: 0,
    estimatedArrivalTimes: deliveries.map((_, index) => new Date(currentTime.getTime() + (index + 1) * 30 * 60000)),
    trafficAdjustments: deliveries.map(() => 1.0),
    isValid: false,
    errors: [...errors, "Using fallback optimization due to errors"],
  })

  async optimizeRoute(
    waypoints: OptimizationWaypoint[],
    options: RouteOptimizationOptions = {},
  ): Promise<OptimizedRoute> {
    if (waypoints.length < 2) throw new Error("At least 2 waypoints are required")
    return this.optimizeWithOSRM(waypoints)
  }

  analyzeRoute(
    route: number[],
    coordinates: [number, number][],
  ): {
    totalDistance: number
    averageSegmentDistance: number
    longestSegment: number
    shortestSegment: number
    clusteringScore: number
  } {
    if (route.length < 2) {
      return {
        totalDistance: 0,
        averageSegmentDistance: 0,
        longestSegment: 0,
        shortestSegment: 0,
        clusteringScore: 0,
      }
    }

    const segmentDistances: number[] = []
    for (let i = 0; i < route.length - 1; i++) {
      const from = coordinates[route[i]]
      const to = coordinates[route[i + 1]]
      if (from && to) {
        segmentDistances.push(distanceCalculator.calculateRealWorldDistance(from, to))
      }
    }

    const totalDistance = segmentDistances.reduce((sum, dist) => sum + dist, 0)
    const averageSegmentDistance = totalDistance / segmentDistances.length
    const longestSegment = Math.max(...segmentDistances)
    const shortestSegment = Math.min(...segmentDistances)

    // Simple clustering score: lower is better
    const stdDev = Math.sqrt(
      segmentDistances.map((x) => Math.pow(x - averageSegmentDistance, 2)).reduce((a, b) => a + b) /
        segmentDistances.length,
    )
    const clusteringScore = stdDev / averageSegmentDistance

    return { totalDistance, averageSegmentDistance, longestSegment, shortestSegment, clusteringScore }
  }
}

export const routeOptimizer = new RouteOptimizer()
