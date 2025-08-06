import { ClarkeWrightSavingsAlgorithm, type Customer, type Vehicle, type Depot, type ClarkeWrightResult } from '@/lib/algorithms/clarke-wright-savings'
import { supabaseClient } from '@/lib/supabase-client'

interface OptimizationRequest {
  depot: Depot
  customers: Customer[]
  vehicles: Vehicle[]
  options?: {
    maxRoutesPerVehicle?: number
    prioritizeTimeWindows?: boolean
    balanceRoutes?: boolean
    considerTraffic?: boolean
  }
}

interface OptimizationResponse {
  success: boolean
  result?: ClarkeWrightResult
  statistics?: any
  error?: string
  processingTime: number
}

export class ClarkeWrightService {
  private static instance: ClarkeWrightService
  
  public static getInstance(): ClarkeWrightService {
    if (!ClarkeWrightService.instance) {
      ClarkeWrightService.instance = new ClarkeWrightService()
    }
    return ClarkeWrightService.instance
  }

  /**
   * Optimize routes using Clarke-Wright Savings algorithm
   */
  async optimizeRoutes(request: OptimizationRequest): Promise<OptimizationResponse> {
    const startTime = Date.now()

    try {
      // Validate input
      const validation = this.validateInput(request)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          processingTime: Date.now() - startTime
        }
      }

      // Create algorithm instance
      const algorithm = new ClarkeWrightSavingsAlgorithm(
        request.depot,
        request.customers,
        request.vehicles
      )

      // Run optimization
      const result = request.options 
        ? algorithm.optimizeWithConstraints(request.options)
        : algorithm.optimize()

      // Get statistics
      const statistics = algorithm.getStatistics(result)

      // Save results to database
      await this.saveOptimizationResults(result, statistics)

      return {
        success: true,
        result,
        statistics,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('Clarke-Wright optimization failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown optimization error',
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Validate optimization input
   */
  private validateInput(request: OptimizationRequest): { isValid: boolean; error?: string } {
    if (!request.depot || !request.depot.coordinates) {
      return { isValid: false, error: 'Valid depot location is required' }
    }

    if (!request.customers || request.customers.length === 0) {
      return { isValid: false, error: 'At least one customer is required' }
    }

    if (!request.vehicles || request.vehicles.length === 0) {
      return { isValid: false, error: 'At least one vehicle is required' }
    }

    // Validate customer data
    for (const customer of request.customers) {
      if (!customer.coordinates || customer.coordinates.length !== 2) {
        return { isValid: false, error: `Invalid coordinates for customer ${customer.id}` }
      }
      if (customer.demand <= 0) {
        return { isValid: false, error: `Invalid demand for customer ${customer.id}` }
      }
    }

    // Validate vehicle data
    for (const vehicle of request.vehicles) {
      if (vehicle.capacity <= 0) {
        return { isValid: false, error: `Invalid capacity for vehicle ${vehicle.id}` }
      }
    }

    // Check if total demand can be satisfied
    const totalDemand = request.customers.reduce((sum, customer) => sum + customer.demand, 0)
    const totalCapacity = request.vehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0)
    
    if (totalDemand > totalCapacity) {
      return { isValid: false, error: 'Total customer demand exceeds total vehicle capacity' }
    }

    return { isValid: true }
  }

  /**
   * Save optimization results to database
   */
  private async saveOptimizationResults(result: ClarkeWrightResult, statistics: any): Promise<void> {
    try {
      const optimizationRecord = {
        algorithm: 'clarke-wright-savings',
        total_routes: result.routes.length,
        total_distance: result.totalDistance,
        total_time: result.totalTime,
        processing_time: result.processingTime,
        iterations: result.iterations,
        unassigned_customers: result.unassignedCustomers.length,
        efficiency: statistics.efficiency,
        utilization_rate: statistics.utilizationRate,
        savings_achieved: statistics.savingsAchieved,
        result_data: JSON.stringify({
          routes: result.routes,
          savings: result.savings.slice(0, 100), // Store top 100 savings
          statistics
        }),
        created_at: new Date().toISOString()
      }

      const { error } = await supabaseClient
        .from('route_optimizations')
        .insert(optimizationRecord)

      if (error) {
        console.error('Failed to save optimization results:', error)
      }
    } catch (error) {
      console.error('Error saving optimization results:', error)
    }
  }

  /**
   * Convert orders to customers format
   */
  convertOrdersToCustomers(orders: any[]): Customer[] {
    return orders.map(order => ({
      id: order.id,
      coordinates: order.coordinates || [43.6532, -79.3832], // Default to Toronto
      demand: order.package_weight || 1,
      timeWindow: order.delivery_window_start && order.delivery_window_end ? {
        start: this.parseTimeToMinutes(order.delivery_window_start),
        end: this.parseTimeToMinutes(order.delivery_window_end)
      } : undefined,
      serviceTime: this.calculateServiceTime(order)
    }))
  }

  /**
   * Convert drivers to vehicles format
   */
  convertDriversToVehicles(drivers: any[]): Vehicle[] {
    return drivers.map(driver => ({
      id: driver.id,
      capacity: this.getVehicleCapacity(driver.vehicle_type),
      maxDistance: 500, // 500km max distance
      maxTime: 480 // 8 hours max time
    }))
  }

  /**
   * Get vehicle capacity based on type
   */
  private getVehicleCapacity(vehicleType?: string): number {
    const capacities: { [key: string]: number } = {
      'small_van': 50,
      'large_van': 100,
      'small_truck': 200,
      'large_truck': 500,
      'motorcycle': 10
    }
    return capacities[vehicleType || 'small_van'] || 50
  }

  /**
   * Calculate service time for an order
   */
  private calculateServiceTime(order: any): number {
    let baseTime = 10 // 10 minutes base service time
    
    if (order.priority === 'urgent') baseTime += 5
    if (order.special_requirements) baseTime += 10
    if (order.package_weight && order.package_weight > 10) baseTime += 5
    
    return baseTime
  }

  /**
   * Parse time string to minutes
   */
  private parseTimeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Get optimization history
   */
  async getOptimizationHistory(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient
        .from('route_optimizations')
        .select('*')
        .eq('algorithm', 'clarke-wright-savings')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to fetch optimization history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching optimization history:', error)
      return []
    }
  }
}

export const clarkeWrightService = ClarkeWrightService.getInstance()
