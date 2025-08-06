"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, FileText, Info } from "lucide-react"

interface TemplateField {
  name: string
  displayName: string
  required: boolean
  description: string
  example: string
  type: "text" | "email" | "number" | "date" | "select"
  options?: string[]
}

const templateFields: TemplateField[] = [
  {
    name: "order_number",
    displayName: "Order Number",
    required: true,
    description: "Unique identifier for the order",
    example: "ORD-2024-001",
    type: "text",
  },
  {
    name: "customer_name",
    displayName: "Customer Name",
    required: true,
    description: "Full name of the customer",
    example: "John Smith",
    type: "text",
  },
  {
    name: "customer_email",
    displayName: "Customer Email",
    required: false,
    description: "Customer's email address for notifications",
    example: "john.smith@email.com",
    type: "email",
  },
  {
    name: "delivery_address",
    displayName: "Delivery Address",
    required: true,
    description: "Complete delivery address including postal code",
    example: "123 Main St, Toronto, ON M5V 3A8",
    type: "text",
  },
  {
    name: "priority",
    displayName: "Priority",
    required: false,
    description: "Delivery priority level",
    example: "normal",
    type: "select",
    options: ["urgent", "high", "normal", "low"],
  },
  {
    name: "special_requirements",
    displayName: "Special Requirements",
    required: false,
    description: "Any special delivery instructions or requirements",
    example: "Ring doorbell twice, fragile items",
    type: "text",
  },
  {
    name: "package_weight",
    displayName: "Package Weight (kg)",
    required: false,
    description: "Weight of the package in kilograms",
    example: "2.5",
    type: "number",
  },
  {
    name: "delivery_window_start",
    displayName: "Delivery Window Start",
    required: false,
    description: "Earliest delivery time (HH:MM format)",
    example: "09:00",
    type: "text",
  },
  {
    name: "delivery_window_end",
    displayName: "Delivery Window End",
    required: false,
    description: "Latest delivery time (HH:MM format)",
    example: "17:00",
    type: "text",
  },
]

const sampleData = [
  {
    order_number: "ORD-2024-001",
    customer_name: "John Smith",
    customer_email: "john.smith@email.com",
    delivery_address: "123 Main St, Toronto, ON M5V 3A8",
    priority: "normal",
    special_requirements: "Ring doorbell twice",
    package_weight: "2.5",
    delivery_window_start: "09:00",
    delivery_window_end: "17:00",
  },
  {
    order_number: "ORD-2024-002",
    customer_name: "Sarah Johnson",
    customer_email: "sarah.j@email.com",
    delivery_address: "456 Oak Ave, Toronto, ON M4W 2H1",
    priority: "high",
    special_requirements: "Fragile items, handle with care",
    package_weight: "1.2",
    delivery_window_start: "10:00",
    delivery_window_end: "16:00",
  },
  {
    order_number: "ORD-2024-003",
    customer_name: "Mike Wilson",
    customer_email: "mike.wilson@email.com",
    delivery_address: "789 Pine St, Toronto, ON M6K 1X9",
    priority: "urgent",
    special_requirements: "Leave at front desk if no answer",
    package_weight: "5.0",
    delivery_window_start: "08:00",
    delivery_window_end: "12:00",
  },
]

export default function OrderTemplateGenerator() {
  const [templateType, setTemplateType] = useState<"empty" | "sample">("empty")

  const generateCSV = (includeSampleData = false) => {
    // Create header row
    const headers = templateFields.map((field) => field.displayName)

    let csvContent = headers.join(",") + "\n"

    // Add sample data if requested
    if (includeSampleData) {
      sampleData.forEach((row) => {
        const values = templateFields.map((field) => {
          const value = (row as any)[field.name] || ""
          // Escape commas and quotes in CSV
          if (value.includes(",") || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        csvContent += values.join(",") + "\n"
      })
    }

    return csvContent
  }

  const downloadTemplate = (includeSampleData = false) => {
    const csvContent = generateCSV(includeSampleData)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `order-template-${includeSampleData ? "sample" : "empty"}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Order Import Template
          </CardTitle>
          <CardDescription>
            Download a CSV template to import your orders. Choose between an empty template or one with sample data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => downloadTemplate(false)} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Empty Template
            </Button>
            <Button onClick={() => downloadTemplate(true)}>
              <Download className="h-4 w-4 mr-2" />
              Download Sample Template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Field Specifications</CardTitle>
          <CardDescription>Understanding the required and optional fields for order import</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {templateFields.map((field, index) => (
              <div key={field.name}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{field.displayName}</h4>
                    {field.required ? (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Optional
                      </Badge>
                    )}
                    {field.type === "select" && (
                      <Badge variant="outline" className="text-xs">
                        {field.options?.join(" | ")}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{field.description}</p>
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded">Example: {field.example}</p>
                {index < templateFields.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Info className="h-5 w-5" />
            Import Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700 space-y-2">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Ensure all required fields (Order Number, Customer Name, Delivery Address) are filled</li>
            <li>Use complete addresses including postal codes for better geocoding accuracy</li>
            <li>Priority levels: urgent, high, normal, low (defaults to normal if not specified)</li>
            <li>Time windows should be in HH:MM format (24-hour)</li>
            <li>Package weight should be in kilograms as a decimal number</li>
            <li>Email addresses will be validated during import</li>
            <li>Orders will be automatically geocoded after import for route optimization</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
