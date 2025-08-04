"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { OptimizedRoutesDisplay } from "./optimized-routes-display"
import { Play, BarChart3, History, CheckCircle, Loader2, Route } from "lucide-react"

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  delivery_address: string
  status: string
  priority?: string
  created_at: string
  updated_at: string
}

interface OptimizationParameters {
  maxDrivers: number
  maxStopsPerRoute: number
  optimizationCriteria: string
  considerTraffic: boolean
  considerTimeWindows: boolean
  workingHours: {
    start: string
    end: string
  }
  warehouseAddress: string
  travelMode: string
  avoidTolls: boolean
  avoidHighways: boolean
}

interface RouteOptimizationPanelProps {
  selectedOrders: Order[]
  adminId: string
  onOptimizationComplete?: (result: any) => void
}

export function RouteOptimizationPanel({
  selectedOrders = [],
  adminId,
  onOptimizationComplete,
}: RouteOptimizationPanelProps) {
  const { toast } = useToast()
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationProgress, setOptimizationProgress] = useState(0)
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [optimizationHistory, setOptimizationHistory] = useState<any[]>([])
  const [parameters, setParameters] = useState<OptimizationParameters>({
    maxDrivers: 3,
    maxStopsPerRoute: 15,
    optimizationCriteria: "balanced",
    considerTraffic: true,
    considerTimeWindows: true,
    workingHours: {
      start: "08:00",
      end: "18:00",
    },
    warehouseAddress: "Toronto, ON, Canada",
    travelMode: "DRIVE",
    avoidTolls: false,
    avoidHighways: false,
  })

  useEffect(() => {
    if (adminId) {
      fetchOptimizationHistory()
    }
  }, [adminId])

  const fetchOptimizationHistory = async () => {
    try {
      const response = await fetch(`/api/optimize-routes?adminId=${adminId}`)
      const data = await response.json()

      if (data.success) {
        setOptimizationHistory(data.data || [])
        if (data.message) {
          console.log("ℹ️", data.message)
        }
      } else {
        console.warn("⚠️ Failed to fetch optimization history:", data.error)
        setOptimizationHistory([])
      }
    } catch (error) {
      console.error("❌ Error fetching optimization history:", error)
      setOptimizationHistory([])
    }
  }

  const handleOptimize = async () => {
    if (!selectedOrders || selectedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to optimize routes.",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)
    setOptimizationProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setOptimizationProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 15
        })
      }, 200)

      const response = await fetch("/api/optimize-routes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selectedOrders.map((order) => order.id),
          adminId,
          parameters,
        }),
      })

      clearInterval(progressInterval)
      setOptimizationProgress(100)

      const data = await response.json()

      if (data.success) {
        setOptimizationResult(data.data)
        onOptimizationComplete?.(data.data)

        toast({
          title: "Optimization Complete!",
          description: `Created ${data.data?.routes?.length || 0} optimized routes using ${data.api_calls_used || 0} API calls.`,
        })

        // Refresh history
        await fetchOptimizationHistory()
      } else {
        throw new Error(data.error || "Optimization failed")
      }
    } catch (error) {
      console.error("❌ Optimization error:", error)
      toast({
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsOptimizing(false)
      setOptimizationProgress(0)
    }
  }

  const resetOptimization = () => {
    setOptimizationResult(null)
    setOptimizationProgress(0)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Route className="h-5 w-5" />
            Route Optimization
          </CardTitle>
          <CardDescription className="text-slate-400">
            Optimize delivery routes for {selectedOrders?.length || 0} selected orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="parameters" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-700 border-slate-600">
              <TabsTrigger
                value="parameters"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Parameters
              </TabsTrigger>
              <TabsTrigger value="results" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                Results
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="parameters" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxDrivers" className="text-slate-300">
                    Maximum Drivers
                  </Label>
                  <Input
                    id="maxDrivers"
                    type="number"
                    min="1"
                    max="10"
                    value={parameters.maxDrivers}
                    onChange={(e) =>
                      setParameters((prev) => ({
                        ...prev,
                        maxDrivers: Number.parseInt(e.target.value) || 1,
                      }))
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStops" className="text-slate-300">
                    Max Stops per Route
                  </Label>
                  <Input
                    id="maxStops"
                    type="number"
                    min="1"
                    max="50"
                    value={parameters.maxStopsPerRoute}
                    onChange={(e) =>
                      setParameters((prev) => ({
                        ...prev,
                        maxStopsPerRoute: Number.parseInt(e.target.value) || 1,
                      }))
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="criteria" className="text-slate-300">
                    Optimization Criteria
                  </Label>
                  <Select
                    value={parameters.optimizationCriteria}
                    onValueChange={(value) =>
                      setParameters((prev) => ({
                        ...prev,
                        optimizationCriteria: value,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="distance">Minimize Distance</SelectItem>
                      <SelectItem value="time">Minimize Time</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="fuel">Minimize Fuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warehouse" className="text-slate-300">
                    Warehouse Address
                  </Label>
                  <Input
                    id="warehouse"
                    value={parameters.warehouseAddress}
                    onChange={(e) =>
                      setParameters((prev) => ({
                        ...prev,
                        warehouseAddress: e.target.value,
                      }))
                    }
                    placeholder="Enter warehouse address"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startTime" className="text-slate-300">
                    Working Hours Start
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={parameters.workingHours.start}
                    onChange={(e) =>
                      setParameters((prev) => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, start: e.target.value },
                      }))
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime" className="text-slate-300">
                    Working Hours End
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={parameters.workingHours.end}
                    onChange={(e) =>
                      setParameters((prev) => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, end: e.target.value },
                      }))
                    }
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              <Separator className="bg-slate-600" />

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handleOptimize}
                  disabled={isOptimizing || !selectedOrders || selectedOrders.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Optimize Routes
                    </>
                  )}
                </Button>

                {optimizationResult && (
                  <Button
                    variant="outline"
                    onClick={resetOptimization}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  >
                    Reset
                  </Button>
                )}
              </div>

              {isOptimizing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Optimization Progress</span>
                    <span>{Math.round(optimizationProgress)}%</span>
                  </div>
                  <Progress value={optimizationProgress} className="w-full bg-slate-700" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="results">
              {optimizationResult ? (
                <OptimizedRoutesDisplay result={optimizationResult} adminId={adminId} />
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <BarChart3 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No optimization results yet.</p>
                  <p className="text-sm">Run an optimization to see results here.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <ScrollArea className="h-[400px]">
                {optimizationHistory && optimizationHistory.length > 0 ? (
                  <div className="space-y-4">
                    {optimizationHistory.map((optimization, index) => (
                      <Card key={optimization.id || index} className="p-4 bg-slate-700 border-slate-600">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-slate-600 text-slate-200">
                                {optimization.optimization_type || "Unknown"}
                              </Badge>
                              <span className="text-sm text-slate-400">
                                {new Date(optimization.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-300">
                              {optimization.total_routes || 0} routes, {optimization.total_orders || 0} orders
                            </p>
                            <p className="text-xs text-slate-400">
                              Distance: {optimization.total_distance || 0} km, Duration:{" "}
                              {optimization.total_duration || 0} min
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-slate-500 text-slate-300">
                              {optimization.api_calls_used || 0} API calls
                            </Badge>
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No optimization history found.</p>
                    <p className="text-sm">Previous optimizations will appear here.</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
