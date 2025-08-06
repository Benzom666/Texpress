"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Route,
  Truck,
  User,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  Printer,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Navigation,
  Search,
} from "lucide-react"

interface RouteData {
  id: string
  route_number: string
  name: string
  status: string
  driver_id?: string
  total_distance: number
  total_duration: number
  total_driving_time: number
  created_at: string
  assigned_at?: string
  route_stops: Array<{
    id: string
    stop_number: number
    address: string
    status: string
    estimated_arrival_time: string
    orders?: {
      id: string
      order_number: string
      customer_name: string
    }
  }>
  route_assignments?: Array<{
    id: string
    driver_id: string
    assigned_at: string
    status: string
  }>
  stats?: {
    total_stops: number
    completed_stops: number
    pending_stops: number
    failed_stops: number
    completion_percentage: number
  }
}

interface Driver {
  id: string
  user_id: string
  name: string
  email: string
  status: string
}

interface RouteManagementProps {
  adminId: string
  drivers: Driver[]
  onRouteSelected?: (routeId: string) => void
}

export function RouteManagement({ adminId, drivers, onRouteSelected }: RouteManagementProps) {
  const { toast } = useToast()

  // State management
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null)
  const [showRouteDetails, setShowRouteDetails] = useState(false)
  const [showLabelDialog, setShowLabelDialog] = useState(false)

  // Load routes on component mount
  useEffect(() => {
    loadRoutes()
  }, [adminId])

  const loadRoutes = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/optimize-routes-graphhopper?adminId=${adminId}`)
      const data = await response.json()

      if (data.success && data.data.routes) {
        setRoutes(data.data.routes)
      }
    } catch (error) {
      console.error("❌ Error loading routes:", error)
      toast({
        title: "Error Loading Routes",
        description: "Failed to load routes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredRoutes = routes.filter((route) => {
    const matchesSearch =
      route.route_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || route.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: "bg-gray-100 text-gray-800", icon: Edit },
      optimized: { color: "bg-blue-100 text-blue-800", icon: Route },
      assigned: { color: "bg-yellow-100 text-yellow-800", icon: User },
      in_progress: { color: "bg-purple-100 text-purple-800", icon: Navigation },
      completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      cancelled: { color: "bg-red-100 text-red-800", icon: AlertCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    const Icon = config.icon

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    )
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatDistance = (km: number) => {
    return `${km.toFixed(1)} km`
  }

  const handleAssignDriver = async (routeId: string, driverId: string) => {
    try {
      const response = await fetch("/api/assign-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId,
          driverId,
          assignedBy: adminId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Assignment failed")
      }

      await loadRoutes() // Reload routes to get updated data

      const driver = drivers.find((d) => d.user_id === driverId)
      toast({
        title: "Route Assigned",
        description: `Route assigned to ${driver?.name || "driver"} successfully.`,
      })
    } catch (error) {
      console.error("❌ Route assignment error:", error)
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign route.",
        variant: "destructive",
      })
    }
  }

  const handleUnassignRoute = async (routeId: string) => {
    try {
      const response = await fetch(`/api/assign-route?routeId=${routeId}&unassignedBy=${adminId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Unassignment failed")
      }

      await loadRoutes() // Reload routes

      toast({
        title: "Route Unassigned",
        description: "Route has been unassigned successfully.",
      })
    } catch (error) {
      console.error("❌ Route unassignment error:", error)
      toast({
        title: "Unassignment Failed",
        description: error instanceof Error ? error.message : "Failed to unassign route.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteRoute = async (routeId: string) => {
    try {
      const response = await fetch(`/api/routes/${routeId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete route")
      }

      setRoutes((prev) => prev.filter((route) => route.id !== routeId))

      toast({
        title: "Route Deleted",
        description: "Route has been deleted successfully.",
      })
    } catch (error) {
      console.error("❌ Route deletion error:", error)
      toast({
        title: "Deletion Failed",
        description: "Failed to delete route. Please try again.",
        variant: "destructive",
      })
    }
  }

  const generateRouteLabel = async (routeId: string, format: "pdf" | "png" = "pdf") => {
    try {
      const response = await fetch("/api/generate-route-label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId,
          labelType: "route_summary",
          format,
          includeMap: true,
          includeQrCode: true,
          includeBarcode: true,
          includeStopDetails: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate route label")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `route-label-${routeId}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Route Label Generated",
        description: `Route label has been downloaded as ${format.toUpperCase()}.`,
      })
    } catch (error) {
      console.error("❌ Route label generation error:", error)
      toast({
        title: "Label Generation Failed",
        description: "Failed to generate route label. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getDriverName = (driverId: string) => {
    const driver = drivers.find((d) => d.user_id === driverId)
    return driver?.name || "Unknown Driver"
  }

  const routeStats = {
    total: routes.length,
    assigned: routes.filter((r) => r.status === "assigned").length,
    inProgress: routes.filter((r) => r.status === "in_progress").length,
    completed: routes.filter((r) => r.status === "completed").length,
  }

  return (
    <div className="space-y-6">
      {/* Route Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Routes</p>
                <p className="text-2xl font-bold">{routeStats.total}</p>
              </div>
              <Route className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assigned</p>
                <p className="text-2xl font-bold">{routeStats.assigned}</p>
              </div>
              <User className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{routeStats.inProgress}</p>
              </div>
              <Navigation className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{routeStats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Route Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Route Management
              </CardTitle>
              <CardDescription>Manage optimized delivery routes, assign drivers, and track progress</CardDescription>
            </div>
            <Button onClick={loadRoutes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search routes by number or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="optimized">Optimized</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Routes Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div className="text-center py-8">
              <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Routes Found</h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== "all"
                  ? "No routes match your current filters."
                  : "No routes have been created yet."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Stops</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{route.route_number}</p>
                        <p className="text-sm text-muted-foreground">{route.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(route.status)}</TableCell>
                    <TableCell>
                      {route.driver_id ? (
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">{getDriverName(route.driver_id)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{route.route_stops?.length || 0} stops</Badge>
                    </TableCell>
                    <TableCell>{formatDistance(route.total_distance)}</TableCell>
                    <TableCell>{formatDuration(route.total_duration)}</TableCell>
                    <TableCell>
                      {route.stats && (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${route.stats.completion_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {route.stats.completion_percentage.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(route.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRoute(route)
                              setShowRouteDetails(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>

                          {!route.driver_id ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <DropdownMenuItem>
                                  <User className="h-4 w-4 mr-2" />
                                  Assign Driver
                                </DropdownMenuItem>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="left">
                                {drivers.map((driver) => (
                                  <DropdownMenuItem
                                    key={driver.user_id}
                                    onClick={() => handleAssignDriver(route.id, driver.user_id)}
                                  >
                                    {driver.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUnassignRoute(route.id)}>
                              <User className="h-4 w-4 mr-2" />
                              Unassign Driver
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem onClick={() => generateRouteLabel(route.id, "pdf")}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Label
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => generateRouteLabel(route.id, "pdf")}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print Label
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => handleDeleteRoute(route.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Route
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Route Details Dialog */}
      <Dialog open={showRouteDetails} onOpenChange={setShowRouteDetails}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Route Details: {selectedRoute?.route_number}</DialogTitle>
            <DialogDescription>Detailed information about the selected route and its stops</DialogDescription>
          </DialogHeader>

          {selectedRoute && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="stops">Stops ({selectedRoute.route_stops?.length || 0})</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Route Information</p>
                        <div className="space-y-1">
                          <p className="text-sm">Number: {selectedRoute.route_number}</p>
                          <p className="text-sm">Name: {selectedRoute.name}</p>
                          <p className="text-sm">Status: {getStatusBadge(selectedRoute.status)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Route Metrics</p>
                        <div className="space-y-1">
                          <p className="text-sm">Distance: {formatDistance(selectedRoute.total_distance)}</p>
                          <p className="text-sm">Duration: {formatDuration(selectedRoute.total_duration)}</p>
                          <p className="text-sm">Stops: {selectedRoute.route_stops?.length || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {selectedRoute.driver_id && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Assigned Driver</p>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-blue-600" />
                          <span>{getDriverName(selectedRoute.driver_id)}</span>
                        </div>
                        {selectedRoute.assigned_at && (
                          <p className="text-xs text-muted-foreground">
                            Assigned: {new Date(selectedRoute.assigned_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="stops" className="space-y-4">
                <div className="space-y-2">
                  {selectedRoute.route_stops?.map((stop) => (
                    <Card key={stop.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                              {stop.stop_number}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{stop.orders?.order_number || "Unknown Order"}</p>
                              <p className="text-xs text-muted-foreground">{stop.address}</p>
                              {stop.orders?.customer_name && (
                                <p className="text-xs text-muted-foreground">Customer: {stop.orders.customer_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(stop.status)}
                            <p className="text-xs text-muted-foreground mt-1">
                              ETA: {new Date(stop.estimated_arrival_time).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) || <p className="text-center text-muted-foreground py-4">No stops found for this route.</p>}
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                {selectedRoute.stats ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Completion Progress</p>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Completed:</span>
                              <span>
                                {selectedRoute.stats.completed_stops}/{selectedRoute.stats.total_stops}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${selectedRoute.stats.completion_percentage}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {selectedRoute.stats.completion_percentage.toFixed(1)}% complete
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Stop Status</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Pending:</span>
                              <span>{selectedRoute.stats.pending_stops}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Completed:</span>
                              <span>{selectedRoute.stats.completed_stops}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Failed:</span>
                              <span>{selectedRoute.stats.failed_stops}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No performance data available.</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
