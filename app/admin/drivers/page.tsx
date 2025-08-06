'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Plus, Search, Users, UserCheck, UserX, Clock } from 'lucide-react'
import { useDrivers, useDriverMutations } from '@/hooks/useApi'
import Link from 'next/link'

export default function DriversPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: drivers, loading: driversLoading, error: driversError, refetch: refetchDrivers } = useDrivers({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    availability_status: availabilityFilter !== 'all' ? availabilityFilter : undefined
  })

  const { updateDriverStatus, loading: updateLoading } = useDriverMutations()

  const handleStatusChange = async (driverId: string, newStatus: string) => {
    const success = await updateDriverStatus(driverId, newStatus)
    if (success) {
      refetchDrivers()
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-500/10 text-green-400 border-green-500/20',
      inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return colors[status as keyof typeof colors] || colors.active
  }

  const getAvailabilityColor = (availability: string) => {
    const colors = {
      available: 'bg-green-500/10 text-green-400 border-green-500/20',
      assigned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      offline: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      busy: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    }
    return colors[availability as keyof typeof colors] || colors.offline
  }

  const filteredDrivers = drivers?.filter(driver => 
    `${driver.first_name} ${driver.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (driversError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Error Loading Drivers</h3>
          <p className="text-slate-400 mb-4">{driversError}</p>
          <Button onClick={refetchDrivers} className="bg-blue-600 hover:bg-blue-700">
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
          <h1 className="text-2xl font-bold text-white mb-1">Driver Management</h1>
          <p className="text-slate-400">Manage drivers and their availability</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={refetchDrivers}
            disabled={driversLoading}
            variant="outline"
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${driversLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/admin/drivers/create">
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Drivers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{drivers?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Available</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {drivers?.filter(d => d.availability_status === 'available').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Assigned</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {drivers?.filter(d => d.availability_status === 'assigned').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Offline</CardTitle>
            <UserX className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {drivers?.filter(d => d.availability_status === 'offline').length || 0}
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
                  placeholder="Search drivers..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Availability</label>
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">All Availability</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Drivers</CardTitle>
          <CardDescription className="text-slate-400">
            Manage driver profiles and availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          {driversLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredDrivers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">Driver</TableHead>
                    <TableHead className="text-slate-300">Contact</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Availability</TableHead>
                    <TableHead className="text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.map((driver) => (
                    <TableRow key={driver.id} className="border-slate-700">
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">
                            {driver.first_name} {driver.last_name}
                          </p>
                          <p className="text-sm text-slate-400">ID: {driver.id.slice(0, 8)}...</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white">{driver.email}</p>
                          {driver.phone && (
                            <p className="text-sm text-slate-400">{driver.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(driver.status || 'active')}`}>
                          {driver.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getAvailabilityColor(driver.availability_status || 'offline')}`}>
                          {driver.availability_status || 'offline'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Link href={`/admin/drivers/${driver.id}`}>View</Link>
                          </Button>
                          <Select
                            onValueChange={(status) => handleStatusChange(driver.id, status)}
                            disabled={updateLoading}
                          >
                            <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-700 text-white">
                              <SelectValue placeholder="Change" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="available">Available</SelectItem>
                              <SelectItem value="assigned">Assigned</SelectItem>
                              <SelectItem value="offline">Offline</SelectItem>
                              <SelectItem value="busy">Busy</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">No drivers found</h3>
              <p className="text-slate-400 mb-4">Add your first driver to get started</p>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/drivers/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Driver
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
