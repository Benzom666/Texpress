"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { BarChart3, Package, Route, Truck, Settings, Menu, Home, MapPin, Zap } from 'lucide-react'

const navigation = [
  { name: "Dashboard", href: "/admin/dashboard", icon: Home },
  { name: "Orders", href: "/admin/orders", icon: Package },
  { name: "Routes", href: "/admin/routes", icon: Route },
  { name: "Dispatch", href: "/admin/dispatch", icon: MapPin },
  { name: "Drivers", href: "/admin/drivers", icon: Truck },
  { name: "Integrations", href: "/admin/integrations", icon: Zap },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Settings", href: "/admin/settings", icon: Settings },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col bg-gray-800 border-gray-700">
          <nav className="grid gap-2 text-lg font-medium">
            <Link href="/admin/dashboard" className="flex items-center gap-2 text-lg font-semibold text-white">
              <Package className="h-6 w-6" />
              <span>DeliveryOS</span>
            </Link>
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700",
                    pathname === item.href && "bg-gray-700 text-white",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden border-r border-gray-700 bg-gray-800 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b border-gray-700 px-4 lg:h-[60px] lg:px-6">
            <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold text-white">
              <Package className="h-6 w-6" />
              <span>DeliveryOS</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-400 transition-all hover:text-white hover:bg-gray-700",
                      pathname === item.href && "bg-gray-700 text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-gray-700 bg-gray-800 px-4 lg:h-[60px] lg:px-6 md:hidden">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
          </Sheet>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-gray-900">{children}</main>
      </div>
    </div>
  )
}
