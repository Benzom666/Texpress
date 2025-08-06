'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { Truck, MapPin, Clock, Package, Route, Settings, Play, BarChart3, Users, Target, Zap, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { MapboxMap } from '@/components/mapbox-map'

interface Customer {
  id: string
  coordinates: [number, number]
  demand: number
  timeWindow?: {
    start: number
    end: number
  }
  serviceTime: number
  name?: string
  address?: string
}

interface Vehicle {
  id: string
  capacity: number
  maxDistance?: number
  maxTime?: number
  name?: string
}

interface Depot {
  id: string
  coordinates: [number, number]
  name?: string
}

interface OptimizationResult {
  routes: any[]
  totalDistance: number
  totalTime: number
  unassignedCustomers: Customer[]
  statistics: {
    efficiency: number
    utilizationRate: number
    averageRouteDistance: number
    averageRouteTime: number
    savingsAchieved: number
  }
  processingTime: number
  iterations: number
}

export function ClarkeWrightOptimizer() {
  const { toast } = useToast()
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [activeTab, setActiveTab] = useState('setup')

  // Setup state
  const [depot, setDepot] = useState<Depot>({
    id: 'depot_1',
    coordinates: [43.6532, -79.3832], // Toronto
    name: 'Main Depot'
  })

  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { id: 'vehicle_1', capacity: 100, maxDistance: 500, maxTime: 480, name: 'Truck 1' }
  ])

  // Options state
  const [options, setOptions] = useState({
    maxRoutesPerVehicle: 1,
    prioritizeTimeWindows: false,
    balanceRoutes: true,
    considerTraffic: false
  })

  // Form state for adding customers/vehicles
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    address: '',
    coordinates: [43.6532, -79.3832] as [number, number],
    demand: 10,
    serviceTime: 15,
    timeWindowStart: '',
    timeWindowEnd: ''
  })

  const [newVehicle, setNewVehicle] = useState({
    name: '',
    capacity: 100,
    maxDistance: 500,
    maxTime: 480
  })

  useEffect(() => {
    // Load sample data
    loadSampleData()
  }, [])

  const loadSampleData = () => {
    const sampleCustomers: Customer[] = [
      {
        id: 'customer_1',
        coordinates: [43.6629, -79.3957],
        demand: 15,
        serviceTime: 10,
        name: 'Customer A',
        address: '123 Queen St W, Toronto'
      },
      {
        id: 'customer_2',
        coordinates: [43.6426, -79.3871],
        demand: 20,
        serviceTime: 15,
        name: 'Customer B',
        address: '456 King St E, Toronto'
      },
      {
        id: 'customer_3',
        coordinates: [43.6481, -79.3708],
        demand: 12,
        serviceTime: 8,
        name: 'Customer C',
        address: '789 Bay St, Toronto'
      },
      {
        id: 'customer_4',
        coordinates: [43.6590, -79.3656],
        demand: 25,
        serviceTime: 20,
        name: 'Customer D',
        address: '321 Yonge St, Toronto'
      },
      {
        id: 'customer_5',
        coordinates: [43.6677, -79.4103],
        demand: 18,
        serviceTime: 12,
        name: 'Customer E',
        address: '654 Spadina Ave, Toronto'
      }
    ]
    setCustomers(sampleCustomers)
  }

  const addCustomer = () => {
    if (!newCustomer.name || !newCustomer.address) {
      toast({
        title: 'Error',
        description: 'Please fill in customer name and address',
        variant: 'destructive'
      })
      return
    }

    const customer: Customer = {
      id: `customer_${customers.length + 1}`,
      coordinates: newCustomer.coordinates,
      demand: newCustomer.demand,
      serviceTime: newCustomer.serviceTime,
      name: newCustomer.name,
      address: newCustomer.address,
      timeWindow: newCustomer.timeWindowStart && newCustomer.timeWindowEnd ? {
        start: parseTimeToMinutes(newCustomer.timeWindowStart),
        end: parseTimeToMinutes(newCustomer.timeWindowEnd)
      } : undefined
    }

    setCustomers([...customers, customer])
    setNewCustomer({
      name: '',
      address: '',
      coordinates: [43.6532, -79.3832],
      demand: 10,
      serviceTime: 15,
      timeWindowStart: '',
      timeWindowEnd: ''
    })

    toast({
      title: 'Customer Added',
      description: `${customer.name} has been added to the optimization`
    })
  }

  const addVehicle = () => {
    if (!newVehicle.name) {
      toast({
        title: 'Error',
        description: 'Please enter a vehicle name',
        variant: 'destructive'
      })
      return
    }

    const vehicle: Vehicle = {
      id: `vehicle_${vehicles.length + 1}`,
      capacity: newVehicle.capacity,
      maxDistance: newVehicle.maxDistance,
      maxTime: newVehicle.maxTime,
      name: newVehicle.name
    }

    setVehicles([...vehicles, vehicle])
    setNewVehicle({
      name: '',
      capacity: 100,
      maxDistance: 500,
      maxTime: 480
    })

    toast({
      title: 'Vehicle Added',
      description: `${vehicle.name} has been added to the fleet`
    })
  }

  const removeCustomer = (id: string) => {
    setCustomers(customers.filter(c => c.id !== id))
  }

  const removeVehicle = (id: string) => {
    setVehicles(vehicles.filter(v => v.id !== id))
  }

  const parseTimeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  const formatMinutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const runOptimization = async () => {
    if (customers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one customer',
        variant: 'destructive'
      })
      return
    }

    if (vehicles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one vehicle',
        variant: 'destructive'
      })
      return
    }

    setIsOptimizing(true)

    try {
      const response = await fetch('/api/optimize-clarke-wright', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          depot,
          customers,
          vehicles,
          options
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Optimization failed')
      }

      setResult(data.data)
      setActiveTab('results')

      toast({
        title: 'Optimization Complete!',
        description: `Generated ${data.data.routes.length} optimized routes in ${data.data.processingTime}ms`
      })
    } catch (error) {
      console.error('Optimization error:', error)
      toast({
        title: 'Optimization Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  const totalDemand = customers.reduce((sum, customer) => sum + customer.demand, 0)
  const totalCapacity = vehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0)
  const utilizationRate = totalCapacity > 0 ? (totalDemand / totalCapacity) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Clarke-Wright Route Optimizer</h1>
          <p className="text-slate-400 mt-1">
            Advanced route optimization using the Clarke-Wright Savings algorithm
          </p>
        </div>
        <Button
          onClick={runOptimization}
          disabled={isOptimizing || customers.length === 0 || vehicles.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isOptimizing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Optimizing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Optimization
            </>
          )}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Customers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{customers.length}</div>
            <p className="text-xs text-slate-400">Total demand: {totalDemand} units</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{vehicles.length}</div>
            <p className="text-xs text-slate-400">Total capacity: {totalCapacity} units</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Utilization</CardTitle>
            <Target className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{utilizationRate.toFixed(1)}%</div>
            <Progress value={utilizationRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Status</CardTitle>
            {result ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-slate-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {result ? 'Optimized' : 'Ready'}
            </div>
            <p className="text-xs text-slate-400">
              {result ? `${result.routes.length} routes` : 'Configure and run'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800">
          <TabsTrigger value="setup" className="data-[state=active]:bg-slate-700">
            <Settings className="h-4 w-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="customers" className="data-[state=active]:bg-slate-700">
            <Users className="h-4 w-4 mr-2" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="data-[state=active]:bg-slate-700">
            <Truck className="h-4 w-4 mr-2" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="results" className="data-[state=active]:bg-slate-700" disabled={!result}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Depot Configuration */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Depot Configuration
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Set the starting point for all routes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Depot Name</Label>
                  <Input
                    value={depot.name || ''}
                    onChange={(e) => setDepot({ ...depot, name: e.target.value })}
                    placeholder="Main Depot"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={depot.coordinates[0]}
                      onChange={(e) => setDepot({
                        ...depot,
                        coordinates: [parseFloat(e.target.value), depot.coordinates[1]]
                      })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={depot.coordinates[1]}
                      onChange={(e) => setDepot({
                        ...depot,
                        coordinates: [depot.coordinates[0], parseFloat(e.target.value)]
                      })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Optimization Options */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Optimization Options
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Configure algorithm parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Max Routes per Vehicle</Label>
                  <Select
                    value={options.maxRoutesPerVehicle.toString()}
                    onValueChange={(value) => setOptions({
                      ...options,
                      maxRoutesPerVehicle: parseInt(value)
                    })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="1">1 Route</SelectItem>
                      <SelectItem value="2">2 Routes</SelectItem>
                      <SelectItem value="3">3 Routes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Prioritize Time Windows</Label>
                    <Switch
                      checked={options.prioritizeTimeWindows}
                      onCheckedChange={(checked) => setOptions({
                        ...options,
                        prioritizeTimeWindows: checked
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Balance Routes</Label>
                    <Switch
                      checked={options.balanceRoutes}
                      onCheckedChange={(checked) => setOptions({
                        ...options,
                        balanceRoutes: checked
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Consider Traffic</Label>
                    <Switch
                      checked={options.considerTraffic}
                      onCheckedChange={(checked) => setOptions({
                        ...options,
                        considerTraffic: checked
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Add Customer Form */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Add Customer</CardTitle>
                <CardDescription className="text-slate-400">
                  Add a new customer to the optimization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Name</Label>
                    <Input
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="Customer Name"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Demand</Label>
                    <Input
                      type="number"
                      value={newCustomer.demand}
                      onChange={(e) => setNewCustomer({ ...newCustomer, demand: parseInt(e.target.value) })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Address</Label>
                  <Input
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="Customer Address"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={newCustomer.coordinates[0]}
                      onChange={(e) => setNewCustomer({
                        ...newCustomer,
                        coordinates: [parseFloat(e.target.value), newCustomer.coordinates[1]]
                      })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={newCustomer.coordinates[1]}
                      onChange={(e) => setNewCustomer({
                        ...newCustomer,
                        coordinates: [newCustomer.coordinates[0], parseFloat(e.target.value)]
                      })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Service Time (min)</Label>
                    <Input
                      type="number"
                      value={newCustomer.serviceTime}
                      onChange={(e) => setNewCustomer({ ...newCustomer, serviceTime: parseInt(e.target.value) })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Time Window (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={newCustomer.timeWindowStart}
                        onChange={(e) => setNewCustomer({ ...newCustomer, timeWindowStart: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                      <Input
                        type="time"
                        value={newCustomer.timeWindowEnd}
                        onChange={(e) => setNewCustomer({ ...newCustomer, timeWindowEnd: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={addCustomer} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Users className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </CardContent>
            </Card>

            {/* Customer List */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Customer List ({customers.length})</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage customers for optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {customers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{customer.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {customer.demand} units
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">{customer.address}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span>📍 {customer.coordinates[0].toFixed(4)}, {customer.coordinates[1].toFixed(4)}</span>
                          <span>⏱️ {customer.serviceTime}min</span>
                          {customer.timeWindow && (
                            <span>🕒 {formatMinutesToTime(customer.timeWindow.start)}-{formatMinutesToTime(customer.timeWindow.end)}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomer(customer.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {customers.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No customers added yet</p>
                      <p className="text-sm">Add customers to start optimization</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Add Vehicle Form */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Add Vehicle</CardTitle>
                <CardDescription className="text-slate-400">
                  Add a new vehicle to the fleet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Vehicle Name</Label>
                  <Input
                    value={newVehicle.name}
                    onChange={(e) => setNewVehicle({ ...newVehicle, name: e.target.value })}
                    placeholder="Truck 1"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Capacity (units)</Label>
                    <Input
                      type="number"
                      value={newVehicle.capacity}
                      onChange={(e) => setNewVehicle({ ...newVehicle, capacity: parseInt(e.target.value) })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Max Distance (km)</Label>
                    <Input
                      type="number"
                      value={newVehicle.maxDistance}
                      onChange={(e) => setNewVehicle({ ...newVehicle, maxDistance: parseInt(e.target.value) })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Max Time (minutes)</Label>
                  <Input
                    type="number"
                    value={newVehicle.maxTime}
                    onChange={(e) => setNewVehicle({ ...newVehicle, maxTime: parseInt(e.target.value) })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <Button onClick={addVehicle} className="w-full bg-green-600 hover:bg-green-700">
                  <Truck className="h-4 w-4 mr-2" />
                  Add Vehicle
                </Button>
              </CardContent>
            </Card>

            {/* Vehicle List */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Vehicle Fleet ({vehicles.length})</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage vehicles for optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{vehicle.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {vehicle.capacity} units
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span>📦 Capacity: {vehicle.capacity}</span>
                          <span>📏 Max: {vehicle.maxDistance}km</span>
                          <span>⏰ Max: {vehicle.maxTime}min</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVehicle(vehicle.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {vehicles.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No vehicles added yet</p>
                      <p className="text-sm">Add vehicles to start optimization</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {result && (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">Routes</CardTitle>
                    <Route className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{result.routes.length}</div>
                    <p className="text-xs text-slate-400">Generated routes</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">Distance</CardTitle>
                    <MapPin className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{result.totalDistance.toFixed(1)}</div>
                    <p className="text-xs text-slate-400">Total km</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">Time</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{Math.round(result.totalTime)}</div>
                    <p className="text-xs text-slate-400">Total minutes</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">Savings</CardTitle>
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{result.statistics.savingsAchieved.toFixed(1)}%</div>
                    <p className="text-xs text-slate-400">Distance saved</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">Efficiency</CardTitle>
                    <Zap className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{result.statistics.efficiency.toFixed(1)}%</div>
                    <p className="text-xs text-slate-400">Vehicle utilization</p>
                  </CardContent>
                </Card>
              </div>

              {/* Routes Details */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Optimized Routes</CardTitle>
                  <CardDescription className="text-slate-400">
                    Detailed breakdown of each optimized route
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {result.routes.map((route, index) => (
                      <div key={route.id} className="p-4 bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-blue-600">Route {index + 1}</Badge>
                            <span className="text-white font-medium">Vehicle: {route.vehicleId}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span>📦 {route.totalDemand} units</span>
                            <span>📏 {route.totalDistance.toFixed(1)} km</span>
                            <span>⏰ {Math.round(route.totalTime)} min</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-slate-300">Customer Sequence:</h4>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">Depot</Badge>
                            {route.sequence.map((customerId: string, seqIndex: number) => {
                              const customer = customers.find(c => c.id === customerId)
                              return (
                                <div key={customerId} className="flex items-center gap-1">
                                  <span className="text-slate-500">→</span>
                                  <Badge variant="outline" className="text-xs">
                                    {customer?.name || customerId}
                                  </Badge>
                                </div>
                              )
                            })}
                            <span className="text-slate-500">→</span>
                            <Badge variant="outline" className="text-xs">Depot</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Map Visualization */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Route Visualization</CardTitle>
                  <CardDescription className="text-slate-400">
                    Interactive map showing optimized routes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <MapboxMap
                      orders={customers.map(customer => ({
                        id: customer.id,
                        order_number: customer.name || customer.id,
                        customer_name: customer.name || 'Customer',
                        delivery_address: customer.address || 'Address',
                        priority: 'normal',
                        status: 'pending',
                        coordinates: customer.coordinates
                      }))}
                      title="Clarke-Wright Optimized Routes"
                      height="384px"
                      showRoutes={true}
                      depot={depot.coordinates}
                      routes={result.routes}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Algorithm Performance */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Algorithm Performance</CardTitle>
                  <CardDescription className="text-slate-400">
                    Clarke-Wright Savings algorithm statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Processing Time</Label>
                      <div className="text-2xl font-bold text-white">{result.processingTime}ms</div>
                      <p className="text-xs text-slate-400">Algorithm execution time</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Iterations</Label>
                      <div className="text-2xl font-bold text-white">{result.iterations}</div>
                      <p className="text-xs text-slate-400">Savings calculations performed</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Utilization Rate</Label>
                      <div className="text-2xl font-bold text-white">{result.statistics.utilizationRate.toFixed(1)}%</div>
                      <Progress value={result.statistics.utilizationRate} className="mt-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
