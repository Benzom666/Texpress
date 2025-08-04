"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Info } from "lucide-react"

export function OrderTemplateGenerator() {
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "excel">("csv")

  const sampleData = [
    {
      order_number: "ORD-001",
      customer_name: "John Smith",
      customer_email: "john.smith@email.com",
      customer_phone: "+1-416-555-0123",
      pickup_address: "123 King St W, Toronto, ON M5H 3M9",
      delivery_address: "456 Queen St E, Toronto, ON M5A 1T8",
      priority: "normal",
      delivery_notes: "Ring doorbell twice, leave at front door if no answer",
    },
    {
      order_number: "ORD-002",
      customer_name: "Sarah Johnson",
      customer_email: "sarah.j@email.com",
      customer_phone: "+1-416-555-0456",
      pickup_address: "789 Bay St, Toronto, ON M5G 2C8",
      delivery_address: "321 Spadina Ave, Toronto, ON M5T 2E7",
      priority: "high",
      delivery_notes: "Business delivery, ask for reception",
    },
    {
      order_number: "ORD-003",
      customer_name: "Mike Chen",
      customer_email: "mike.chen@email.com",
      customer_phone: "+1-416-555-0789",
      pickup_address: "555 University Ave, Toronto, ON M5G 1X8",
      delivery_address: "888 Yonge St, Toronto, ON M4W 2J2",
      priority: "urgent",
      delivery_notes: "Fragile items, handle with care",
    },
  ]

  const generateCSV = () => {
    const headers = [
      "order_number",
      "customer_name",
      "customer_email",
      "customer_phone",
      "pickup_address",
      "delivery_address",
      "priority",
      "delivery_notes",
    ]

    const csvContent = [
      headers.join(","),
      ...sampleData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row] || ""
            // Escape commas and quotes in CSV
            return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
          })
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "order_import_template.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const generateExcel = () => {
    // For Excel, we'll generate a CSV with Excel-friendly formatting
    const headers = [
      "Order Number",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Pickup Address",
      "Delivery Address",
      "Priority",
      "Delivery Notes",
    ]

    const csvContent = [
      headers.join(","),
      ...sampleData.map((row) =>
        [
          row.order_number,
          row.customer_name,
          row.customer_email,
          row.customer_phone,
          `"${row.pickup_address}"`,
          `"${row.delivery_address}"`,
          row.priority,
          `"${row.delivery_notes}"`,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "order_import_template.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadTemplate = () => {
    if (downloadFormat === "csv") {
      generateCSV()
    } else {
      generateExcel()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Import Template
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Required Fields:</p>
              <ul className="text-xs space-y-1">
                <li>
                  • <strong>order_number</strong> - Unique identifier
                </li>
                <li>
                  • <strong>customer_name</strong> - Full customer name
                </li>
                <li>
                  • <strong>pickup_address</strong> - Complete pickup address
                </li>
                <li>
                  • <strong>delivery_address</strong> - Complete delivery address
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Optional Fields:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">customer_email</Badge>
            <Badge variant="outline">customer_phone</Badge>
            <Badge variant="outline">priority</Badge>
            <Badge variant="outline">delivery_notes</Badge>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Priority Values:</p>
          <div className="flex gap-2">
            <Badge className="bg-gray-100 text-gray-800">low</Badge>
            <Badge className="bg-blue-100 text-blue-800">normal</Badge>
            <Badge className="bg-orange-100 text-orange-800">high</Badge>
            <Badge className="bg-red-100 text-red-800">urgent</Badge>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Sample Data Preview:</p>
          <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto">
            <div className="whitespace-nowrap">order_number,customer_name,pickup_address,delivery_address,priority</div>
            <div className="whitespace-nowrap text-gray-600">
              ORD-001,John Smith,"123 King St W, Toronto","456 Queen St E, Toronto",normal
            </div>
            <div className="whitespace-nowrap text-gray-600">
              ORD-002,Sarah Johnson,"789 Bay St, Toronto","321 Spadina Ave, Toronto",high
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={downloadTemplate} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Use Toronto addresses for best geocoding results</p>
          <p>• Include postal codes when possible</p>
          <p>• Avoid special characters in order numbers</p>
          <p>• Phone numbers can include country code (+1)</p>
        </div>
      </CardContent>
    </Card>
  )
}
