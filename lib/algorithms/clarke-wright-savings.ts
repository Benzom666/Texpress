interface Customer {
  id: string
  coordinates: [number, number]
  demand: number
  timeWindow?: {
    start: number
    end: number
  }
  serviceTime: number
}

interface Vehicle {
  id: string
  capacity: number
  maxDistance?: number
  maxTime?: number
}

interface Depot {
  id: string
  coordinates: [number, number]
}

interface Route {
  id: string
  vehicleId: string
  customers: Customer[]
  totalDistance: number
  totalDemand: number
  totalTime: number
  sequence: string[]
}

interface Saving {
  customerId1: string
  customerId2: string
  value: number
  distance1: number
  distance2: number
  combinedDistance: number
}

interface ClarkeWrightResult {
  routes: Route[]
  totalDistance: number
  totalTime: number
  unassignedCustomers: Customer[]
  savings: Saving[]
  iterations: number
  processingTime: number
}

export class ClarkeWrightSavingsAlgorithm {
  private depot: Depot
  private customers: Customer[]
  private vehicles: Vehicle[]
  private distanceMatrix: number[][]
  private timeMatrix: number[][]

  constructor(depot: Depot, customers: Customer[], vehicles: Vehicle[]) {
    this.depot = depot
    this.customers = customers
    this.vehicles = vehicles
    this.distanceMatrix = []
    this.timeMatrix = []
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const [lat1, lon1] = point1
    const [lat2, lon2] = point2
    const R = 6371 // Earth's radius in kilometers

    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Build distance and time matrices
   */
  private buildMatrices(): void {
    const allPoints = [this.depot.coordinates, ...this.customers.map(c => c.coordinates)]
    const n = allPoints.length

    this.distanceMatrix = Array(n).fill(null).map(() => Array(n).fill(0))
    this.timeMatrix = Array(n).fill(null).map(() => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const distance = this.calculateDistance(allPoints[i], allPoints[j])
          this.distanceMatrix[i][j] = distance
          // Assume average speed of 50 km/h for time calculation
          this.timeMatrix[i][j] = (distance / 50) * 60 // Convert to minutes
        }
      }
    }
  }

  /**
   * Calculate savings for all customer pairs
   */
  private calculateSavings(): Saving[] {
    const savings: Saving[] = []
    const n = this.customers.length

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const customer1 = this.customers[i]
        const customer2 = this.customers[j]

        // Distance from depot to customer 1 (index 0 is depot)
        const distance1 = this.distanceMatrix[0][i + 1]
        // Distance from depot to customer 2
        const distance2 = this.distanceMatrix[0][j + 1]
        // Distance between customer 1 and customer 2
        const combinedDistance = this.distanceMatrix[i + 1][j + 1]

        // Clarke-Wright savings formula: S(i,j) = d(0,i) + d(0,j) - d(i,j)
        const savingValue = distance1 + distance2 - combinedDistance

        savings.push({
          customerId1: customer1.id,
          customerId2: customer2.id,
          value: savingValue,
          distance1,
          distance2,
          combinedDistance
        })
      }
    }

    // Sort savings in descending order
    return savings.sort((a, b) => b.value - a.value)
  }

  /**
   * Check if two customers can be merged into a route
   */
  private canMergeCustomers(
    customer1: Customer,
    customer2: Customer,
    route: Route,
    vehicle: Vehicle
  ): boolean {
    // Check capacity constraint
    const totalDemand = route.totalDemand + customer1.demand + customer2.demand
    if (totalDemand > vehicle.capacity) {
      return false
    }

    // Check time window constraints if they exist
    if (customer1.timeWindow || customer2.timeWindow) {
      // Simplified time window check - in practice, this would be more complex
      const currentTime = route.totalTime
      const travelTime = this.timeMatrix[0][this.customers.findIndex(c => c.id === customer1.id) + 1]
      
      if (customer1.timeWindow && currentTime + travelTime > customer1.timeWindow.end) {
        return false
      }
    }

    return true
  }

  /**
   * Create initial routes (each customer gets its own route)
   */
  private createInitialRoutes(): Route[] {
    const routes: Route[] = []
    
    this.customers.forEach((customer, index) => {
      if (index < this.vehicles.length) {
        const vehicle = this.vehicles[index]
        const distanceToCustomer = this.distanceMatrix[0][index + 1]
        const timeToCustomer = this.timeMatrix[0][index + 1]

        routes.push({
          id: `route_${index}`,
          vehicleId: vehicle.id,
          customers: [customer],
          totalDistance: distanceToCustomer * 2, // Round trip
          totalDemand: customer.demand,
          totalTime: timeToCustomer * 2 + customer.serviceTime,
          sequence: [customer.id]
        })
      }
    })

    return routes
  }

  /**
   * Find route containing a specific customer
   */
  private findRouteWithCustomer(routes: Route[], customerId: string): Route | null {
    return routes.find(route => 
      route.customers.some(customer => customer.id === customerId)
    ) || null
  }

  /**
   * Merge two routes
   */
  private mergeRoutes(route1: Route, route2: Route, saving: Saving): Route {
    const mergedCustomers = [...route1.customers, ...route2.customers]
    const mergedSequence = [...route1.sequence, ...route2.sequence]
    
    // Recalculate total distance for the merged route
    let totalDistance = 0
    let totalTime = 0
    let totalDemand = 0

    // Add distance from depot to first customer
    const firstCustomerIndex = this.customers.findIndex(c => c.id === mergedSequence[0])
    totalDistance += this.distanceMatrix[0][firstCustomerIndex + 1]
    totalTime += this.timeMatrix[0][firstCustomerIndex + 1]

    // Add distances between consecutive customers
    for (let i = 0; i < mergedSequence.length - 1; i++) {
      const currentIndex = this.customers.findIndex(c => c.id === mergedSequence[i])
      const nextIndex = this.customers.findIndex(c => c.id === mergedSequence[i + 1])
      
      totalDistance += this.distanceMatrix[currentIndex + 1][nextIndex + 1]
      totalTime += this.timeMatrix[currentIndex + 1][nextIndex + 1]
    }

    // Add distance from last customer back to depot
    const lastCustomerIndex = this.customers.findIndex(c => c.id === mergedSequence[mergedSequence.length - 1])
    totalDistance += this.distanceMatrix[lastCustomerIndex + 1][0]
    totalTime += this.timeMatrix[lastCustomerIndex + 1][0]

    // Calculate total demand and add service times
    mergedCustomers.forEach(customer => {
      totalDemand += customer.demand
      totalTime += customer.serviceTime
    })

    return {
      id: route1.id, // Keep the first route's ID
      vehicleId: route1.vehicleId, // Keep the first route's vehicle
      customers: mergedCustomers,
      totalDistance,
      totalDemand,
      totalTime,
      sequence: mergedSequence
    }
  }

  /**
   * Main Clarke-Wright Savings algorithm
   */
  public optimize(): ClarkeWrightResult {
    const startTime = Date.now()
    let iterations = 0

    // Build distance and time matrices
    this.buildMatrices()

    // Calculate all savings
    const allSavings = this.calculateSavings()

    // Create initial routes (one customer per route)
    let routes = this.createInitialRoutes()
    const unassignedCustomers = this.customers.slice(routes.length)

    // Process savings in descending order
    for (const saving of allSavings) {
      iterations++

      const route1 = this.findRouteWithCustomer(routes, saving.customerId1)
      const route2 = this.findRouteWithCustomer(routes, saving.customerId2)

      // Skip if customers are already in the same route or routes don't exist
      if (!route1 || !route2 || route1.id === route2.id) {
        continue
      }

      // Find the vehicle for the merged route (use the one with higher capacity)
      const vehicle1 = this.vehicles.find(v => v.id === route1.vehicleId)
      const vehicle2 = this.vehicles.find(v => v.id === route2.vehicleId)
      const vehicle = (vehicle1 && vehicle2 && vehicle1.capacity >= vehicle2.capacity) ? vehicle1 : vehicle2

      if (!vehicle) continue

      // Check if routes can be merged
      const customer1 = this.customers.find(c => c.id === saving.customerId1)!
      const customer2 = this.customers.find(c => c.id === saving.customerId2)!

      if (this.canMergeCustomers(customer1, customer2, route1, vehicle)) {
        // Merge the routes
        const mergedRoute = this.mergeRoutes(route1, route2, saving)
        
        // Check if merged route respects vehicle constraints
        if (mergedRoute.totalDemand <= vehicle.capacity &&
            (!vehicle.maxDistance || mergedRoute.totalDistance <= vehicle.maxDistance) &&
            (!vehicle.maxTime || mergedRoute.totalTime <= vehicle.maxTime)) {
          
          // Remove the old routes and add the merged route
          routes = routes.filter(r => r.id !== route1.id && r.id !== route2.id)
          routes.push(mergedRoute)
        }
      }
    }

    const processingTime = Date.now() - startTime
    const totalDistance = routes.reduce((sum, route) => sum + route.totalDistance, 0)
    const totalTime = routes.reduce((sum, route) => sum + route.totalTime, 0)

    return {
      routes,
      totalDistance,
      totalTime,
      unassignedCustomers,
      savings: allSavings,
      iterations,
      processingTime
    }
  }

  /**
   * Optimize with additional constraints
   */
  public optimizeWithConstraints(options: {
    maxRoutesPerVehicle?: number
    prioritizeTimeWindows?: boolean
    balanceRoutes?: boolean
  }): ClarkeWrightResult {
    // This is an extended version that could include additional constraints
    const result = this.optimize()

    if (options.balanceRoutes) {
      // Implement route balancing logic
      result.routes = this.balanceRoutes(result.routes)
    }

    return result
  }

  /**
   * Balance routes to have similar workloads
   */
  private balanceRoutes(routes: Route[]): Route[] {
    // Simple balancing: try to equalize total distances
    const avgDistance = routes.reduce((sum, route) => sum + route.totalDistance, 0) / routes.length
    
    // This is a simplified version - in practice, you'd implement more sophisticated balancing
    return routes.sort((a, b) => Math.abs(a.totalDistance - avgDistance) - Math.abs(b.totalDistance - avgDistance))
  }

  /**
   * Get algorithm statistics
   */
  public getStatistics(result: ClarkeWrightResult): {
    efficiency: number
    utilizationRate: number
    averageRouteDistance: number
    averageRouteTime: number
    savingsAchieved: number
  } {
    const totalCapacity = this.vehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0)
    const totalDemand = this.customers.reduce((sum, customer) => sum + customer.demand, 0)
    
    const utilizationRate = totalDemand / totalCapacity
    const averageRouteDistance = result.totalDistance / result.routes.length
    const averageRouteTime = result.totalTime / result.routes.length
    
    // Calculate savings compared to individual routes
    const individualRoutesDistance = this.customers.reduce((sum, customer, index) => {
      const distanceToCustomer = this.distanceMatrix[0][index + 1]
      return sum + (distanceToCustomer * 2) // Round trip
    }, 0)
    
    const savingsAchieved = ((individualRoutesDistance - result.totalDistance) / individualRoutesDistance) * 100
    const efficiency = (result.routes.length / this.vehicles.length) * 100

    return {
      efficiency,
      utilizationRate,
      averageRouteDistance,
      averageRouteTime,
      savingsAchieved
    }
  }
}

export type { Customer, Vehicle, Depot, Route, Saving, ClarkeWrightResult }
