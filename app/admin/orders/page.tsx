"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Package,
  Search,
  Trash2,
  UserPlus,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Printer,
  Route,
  Zap,
  Target,
  Settings,
  Map,
} from "lucide-react"
import { RouteOptimizationPanel } from "@/components/route-optimization-panel"
import { OptimizedRoutesDisplay } from "@/components/optimized-routes-display"

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  status: string
  driver_id?: string
  created_by: string
  created_at: string
  updated_at: string
  delivery_window_start?: string
  delivery_window_end?: string
  special_requirements?: string
  package_weight?: number
  shopify_order_id?: string
  shopify_order_number?: string
  coordinates?: [number, number]
  route_number?: number
  stop_number?: number
  estimated_arrival?: string
  zone?: string
  postal_code?: string
}

interface Driver {
  id: string
  user_id: string
  name: string
  email: string
  phone: string
  status: string
  created_by: string
  admin_id?: string
}

export default function OrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State management
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [driversLoading, setDriversLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState("orders")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isGeocodingOrders, setIsGeocodingOrders] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [isGeneratingLabels, setIsGeneratingLabels] = useState(false)

  // Fetch data
  useEffect(() => {
    if (profile) {
      fetchOrders()
      fetchDrivers()
    }
  }, [profile])

  const fetchOrders = async () => {
    if (!profile) return

    try {
      console.log("🔍 Fetching orders for admin:", profile.user_id)

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("created_by", profile.user_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      console.log(`📦 Loaded ${data?.length || 0} orders`)
      setOrders(data || [])
    } catch (error) {
      console.error("❌ Error fetching orders:", error)
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchDrivers = async () => {
    if (!profile) return

    setDriversLoading(true)
    try {
      console.log("🔍 Fetching drivers for admin:", profile.user_id)

      const { data: driversData, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .or(`created_by.eq.${profile.user_id},admin_id.eq.${profile.user_id}`)

      if (error) {
        console.error("❌ Error fetching drivers:", error)
        throw error
      }

      console.log(`👥 Found ${driversData?.length || 0} drivers for admin ${profile.user_id}`)

      const formattedDrivers: Driver[] = (driversData || []).map((driver) => ({
        id: driver.id,
        user_id: driver.user_id,
        name:
          `${driver.first_name || ""} ${driver.last_name || ""}`.trim() ||
          driver.email?.split("@")[0] ||
          "Unknown Driver",
        email: driver.email || "N/A",
        phone: driver.phone || "N/A",
        status: driver.status || "active",
        created_by: driver.created_by,
        admin_id: driver.admin_id,
      }))

      setDrivers(formattedDrivers)

      if (formattedDrivers.length === 0) {
        console.log("⚠️ No drivers found for this admin")
      } else {
        console.log(`✅ Successfully loaded ${formattedDrivers.length} drivers`)
      }
    } catch (error) {
      console.error("❌ Error fetching drivers:", error)
      toast({
        title: "Error",
        description: "Failed to load drivers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDriversLoading(false)
    }
  }

  // Handle file import
  const handleFileImport = async () => {
    if (!importFile || !profile) {
      toast({
        title: "Error",
        description: "Please select a file to import.",
        variant: "destructive",
      })
      return
    }

    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append("file", importFile)
      formData.append("adminId", profile.user_id)

      const response = await fetch("/api/upload-orders", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Import failed")
      }

      toast({
        title: "Import Successful",
        description: `Successfully imported ${result.imported} orders out of ${result.total_processed} processed.`,
      })

      // Refresh orders list
      await fetchOrders()
      setShowImportDialog(false)
      setImportFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("❌ Import error:", error)
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import orders.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Handle optimization completion
  const handleOptimizationComplete = (result: any) => {
    setOptimizationResult(result)
    setActiveTab("routes")

    // Update orders with route assignments
    const updatedOrders = orders.map((order) => {
      const routeOrder = result.routes?.flatMap((route: any) => route.orders).find((ro: any) => ro.id === order.id)

      if (routeOrder) {
        return {
          ...order,
          route_number: routeOrder.route_number,
          stop_number: routeOrder.stop_number,
          estimated_arrival: routeOrder.estimated_arrival,
          zone: routeOrder.zone,
        }
      }
      return order
    })

    setOrders(updatedOrders)
    setSelectedOrders(new Set()) // Clear selection after optimization
  }

  // Filter orders based on search and filters
  const filteredOrders = useMemo(() => {
    let filtered = orders

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((order) => order.priority === priorityFilter)
    }

    return filtered
  }, [orders, searchTerm, statusFilter, priorityFilter])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map((order) => order.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders)
    if (checked) {
      newSelected.add(orderId)
    } else {
      newSelected.delete(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleBulkAssign = async (driverId: string) => {
    if (selectedOrders.size === 0) return

    try {
      const selectedOrderIds = Array.from(selectedOrders)
      const driver = drivers.find((d) => d.user_id === driverId)

      for (const orderId of selectedOrderIds) {
        const { error } = await supabase
          .from("orders")
          .update({
            driver_id: driverId,
            status: "assigned",
            assigned_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        if (error) throw error
      }

      toast({
        title: "Success",
        description: `Assigned ${selectedOrderIds.length} orders to ${driver?.name || "driver"}.`,
      })

      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error("Error bulk assigning orders:", error)
      toast({
        title: "Error",
        description: "Failed to assign orders. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedOrders.size === 0) return

    try {
      const selectedOrderIds = Array.from(selectedOrders)

      for (const orderId of selectedOrderIds) {
        const updateData: any = { status: newStatus }

        if (newStatus === "delivered") {
          updateData.completed_at = new Date().toISOString()
        }

        const { error } = await supabase.from("orders").update(updateData).eq("id", orderId)
        if (error) throw error
      }

      toast({
        title: "Success",
        description: `Updated ${selectedOrderIds.length} orders to ${newStatus}.`,
      })

      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Error",
        description: "Failed to update orders. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) return

    try {
      const selectedOrderIds = Array.from(selectedOrders)

      for (const orderId of selectedOrderIds) {
        const { error } = await supabase.from("orders").delete().eq("id", orderId)
        if (error) throw error
      }

      toast({
        title: "Success",
        description: `Deleted ${selectedOrderIds.length} orders.`,
      })

      setSelectedOrders(new Set())
      setShowDeleteDialog(false)
      fetchOrders()
    } catch (error) {
      console.error("Error deleting orders:", error)
      toast({
        title: "Error",
        description: "Failed to delete orders. Please try again.",
        variant: "destructive",
      })
    }
  }

  const exportOrders = () => {
    const selectedOrdersList =
      selectedOrders.size > 0 ? filteredOrders.filter((order) => selectedOrders.has(order.id)) : filteredOrders

    const csv = [
      "Order Number,Customer Name,Email,Phone,Address,Priority,Status,Route,Stop,Zone,Created At,Coordinates",
      ...selectedOrdersList.map(
        (order) =>
          `${order.order_number},${order.customer_name},${order.customer_email || ""},${order.customer_phone || ""},"${order.delivery_address}",${order.priority},${order.status},${order.route_number || ""},${order.stop_number || ""},${order.zone || ""},${order.created_at},"${order.coordinates ? `${order.coordinates[0]},${order.coordinates[1]}` : ""}"`,
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
      assigned: { color: "bg-blue-100 text-blue-800", icon: UserPlus },
      in_transit: { color: "bg-purple-100 text-purple-800", icon: Package },
      delivered: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      failed: { color: "bg-red-100 text-red-800", icon: AlertCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: "bg-red-100 text-red-800",
      high: "bg-orange-100 text-orange-800",
      normal: "bg-blue-100 text-blue-800",
      low: "bg-gray-100 text-gray-800",
    }

    return (
      <Badge className={priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal}>
        {priority}
      </Badge>
    )
  }

  const getStoreBadge = (order: Order) => {
    if (order.shopify_order_id) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          Shopify
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
        Manual
      </Badge>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-slate-800 min-h-screen p-4">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">DeliveryOS</span>
          </div>

          <nav className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700 text-blue-400">
              <Package className="h-5 w-5" />
              <span>Dashboard</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 cursor-pointer">
              <Route className="h-5 w-5" />
              <span>Dispatch</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-600 text-white">
              <Package className="h-5 w-5" />
              <span>Orders</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 cursor-pointer">
              <UserPlus className="h-5 w-5" />
              <span>Drivers</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 cursor-pointer">
              <Settings className="h-5 w-5" />
              <span>Integrations</span>
            </div>
          </nav>

          <div className="absolute bottom-4 left-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                A
              </div>
              <div>
                <div className="text-sm font-medium">Adi negi</div>
                <div className="text-xs text-slate-400">Admin</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Enhanced Orders Management</h1>
            <p className="text-slate-400">Advanced route optimization with real-time geocoding and enhanced labeling</p>
          </div>

          {/* Driver Status Alert */}
          {driversLoading ? (
            <Card className="border-blue-200 bg-blue-50 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                  <div>
                    <h3 className="font-medium text-blue-800">Loading Drivers...</h3>
                    <p className="text-sm text-blue-700">Fetching available drivers for order assignment.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : drivers.length > 0 ? (
            <Card className="border-green-200 bg-green-900/20 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div>
                    <h3 className="font-medium text-green-300">Drivers Available</h3>
                    <p className="text-sm text-green-400">
                      {drivers.length} driver{drivers.length !== 1 ? "s" : ""} ready to receive optimized route
                      assignments.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-orange-200 bg-orange-900/20 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-400" />
                  <div>
                    <h3 className="font-medium text-orange-300">No Drivers Available</h3>
                    <p className="text-sm text-orange-400">
                      No drivers found. Please add drivers before optimizing and assigning routes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search orders by number, customer, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions Toolbar */}
          {selectedOrders.size > 0 && (
            <Card className="border-blue-200 bg-blue-900/20 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-blue-300">{selectedOrders.size} orders selected</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Assign Driver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Change Status
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Enhanced Labels
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-red-600 hover:bg-red-700 text-white border-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedOrders(new Set())}
                    className="text-slate-400 hover:text-white"
                  >
                    Clear Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
              <TabsTrigger
                value="orders"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Package className="h-4 w-4" />
                Orders ({filteredOrders.length})
              </TabsTrigger>
              <TabsTrigger
                value="optimization"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Zap className="h-4 w-4" />
                Optimization
              </TabsTrigger>
              <TabsTrigger
                value="routes"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Route className="h-4 w-4" />
                Routes {optimizationResult ? `(${optimizationResult.routes?.length || 0})` : ""}
              </TabsTrigger>
              <TabsTrigger
                value="map"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Map className="h-4 w-4" />
                Map View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-4">
              {/* Orders Table */}
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-slate-700">
                        <tr>
                          <th className="text-left p-4">
                            <Checkbox
                              checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                              onCheckedChange={handleSelectAll}
                              className="border-slate-600"
                            />
                          </th>
                          <th className="text-left p-4 text-slate-300">Order</th>
                          <th className="text-left p-4 text-slate-300">Customer</th>
                          <th className="text-left p-4 text-slate-300">Store</th>
                          <th className="text-left p-4 text-slate-300">Status</th>
                          <th className="text-left p-4 text-slate-300">Priority</th>
                          <th className="text-left p-4 text-slate-300">Driver</th>
                          <th className="text-left p-4 text-slate-300">Created</th>
                          <th className="text-left p-4 text-slate-300"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                            <td className="p-4">
                              <Checkbox
                                checked={selectedOrders.has(order.id)}
                                onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                                className="border-slate-600"
                              />
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-white">{order.order_number}</div>
                              <div className="text-sm text-slate-400">{order.delivery_address.split(",")[0]}</div>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-white">{order.customer_name}</div>
                              <div className="text-sm text-slate-400 flex items-center gap-1">
                                <span>📧</span>
                                {order.customer_email}
                              </div>
                              {order.customer_phone && (
                                <div className="text-sm text-slate-400 flex items-center gap-1">
                                  <span>📞</span>
                                  {order.customer_phone}
                                </div>
                              )}
                            </td>
                            <td className="p-4">{getStoreBadge(order)}</td>
                            <td className="p-4">{getStatusBadge(order.status)}</td>
                            <td className="p-4">{getPriorityBadge(order.priority)}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">👤</span>
                                <span className="text-slate-300">Unassigned</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1 text-slate-400">
                                <span>📅</span>
                                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/admin/orders/${order.id}`)}
                                className="text-slate-400 hover:text-white"
                              >
                                •••
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="optimization" className="space-y-4">
              <RouteOptimizationPanel
                selectedOrders={Array.from(selectedOrders)
                  .map((id) => filteredOrders.find((o) => o.id === id)!)
                  .filter(Boolean)}
                adminId={profile.user_id}
                onOptimizationComplete={handleOptimizationComplete}
              />
            </TabsContent>

            <TabsContent value="routes" className="space-y-4">
              {optimizationResult ? (
                <OptimizedRoutesDisplay result={optimizationResult} adminId={profile.user_id} />
              ) : (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center">
                        <Route className="h-8 w-8 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-white">No Routes Optimized</h3>
                        <p className="text-slate-400 mb-4">
                          Select orders and run optimization to create efficient delivery routes.
                        </p>
                        <Button onClick={() => setActiveTab("optimization")} className="bg-blue-600 hover:bg-blue-700">
                          <Zap className="h-4 w-4 mr-2" />
                          Start Optimization
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="map" className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center">
                      <Map className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">Map View</h3>
                      <p className="text-slate-400 mb-4">
                        Interactive map showing optimized routes and delivery locations.
                      </p>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Target className="h-4 w-4 mr-2" />
                        View Map
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orders</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete {selectedOrders.size} selected orders? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
              Delete Orders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
