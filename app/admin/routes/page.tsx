'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Plus, Search, MapPin, Clock, Users, Truck, Route } from 'lucide-react'
import { useRoutes, useDrivers, useRouteMutations } from '@/hooks/useApi'
import Link from 'next/link'

export default function RoutesPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [driverFilter, setDriverFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: routes, loading: routesLoading, error: routesError, refetch: refetchRoutes } = useRoutes({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    driver_id: driverFilter !== 'all' ? driverFilter : undefined
  })

  const { data: drivers } = useDrivers()
  const { assignDriverToRoute, loading: assignLoading } = useRouteMutations()

  const handleAssignDriver = async (routeId: string, driverId: string) => {
    const success = await assignDriverToRoute(routeId, driverId)
    if (success) {
      refetchRoutes()
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      planned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      in_progress: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      completed: 'bg-green-500/10 text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return colors[status as keyof typeof colors] || colors.planned
  }

  const filteredRoutes = routes?.filter(route => 
    route.route_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.route_number.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (routesError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Route className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Error Loading Routes</h3>
          <p className="text-slate-400 mb-4">{routesError}</p>
          <Button onClick={refetchRoutes} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Route Management</h1>
          <p className="text-slate-400">Manage delivery routes and assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={refetchRoutes}
            disabled={routesLoading}
            variant="outline"
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${routesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/admin/routes/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Route
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Routes</CardTitle>
            <Route className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{routes?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">In Progress</CardTitle>
            <Truck className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {routes?.filter(r => r.status === 'in_progress').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Completed</CardTitle>
            <MapPin className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {routes?.filter(r => r.status === 'completed').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Stops</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {routes?.reduce((sum, route) => sum + route.total_stops, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search routes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Driver</label>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routes Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Routes</CardTitle>
          <CardDescription className="text-slate-400">
            Manage and monitor all delivery routes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {routesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredRoutes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">Route</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Driver</TableHead>
                    <TableHead className="text-slate-300">Stops</TableHead>
                    <TableHead className="text-slate-300">Distance</TableHead>
                    <TableHead className="text-slate-300">Duration</TableHead>
                    <TableHead className="text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoutes.map((route) => (
                    <TableRow key={route.id} className="border-slate-700">
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">#{route.route_number}</p>
                          <p className="text-sm text-slate-400">{route.route_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(route.status)}`}>
                          {route.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {route.driver ? (
                          <div>
                            <p className="text-white">{route.driver.first_name} {route.driver.last_name}</p>
                            <p className="text-sm text-slate-400">{route.driver.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-white">{route.total_stops}</TableCell>
                      <TableCell className="text-white">{route.total_distance.toFixed(1)} km</TableCell>
                      <TableCell className="text-white">{Math.round(route.estimated_duration)} min</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Link href={`/admin/routes/${route.id}`}>View</Link>
                          </Button>
                          {!route.driver && (
                            <Select
                              onValueChange={(driverId) => handleAssignDriver(route.id, driverId)}
                              disabled={assignLoading}
                            >
                              <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-700 text-white">
                                <SelectValue placeholder="Assign" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {drivers?.filter(d => d.availability_status === 'available').map((driver) => (
                                  <SelectItem key={driver.id} value={driver.id}>
                                    {driver.first_name} {driver.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Route className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">No routes found</h3>
              <p className="text-slate-400 mb-4">Create your first route to get started</p>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/routes/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Route
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
