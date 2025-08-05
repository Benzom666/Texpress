"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, FileText, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function OrderTemplateGenerator() {
  const generateTemplate = () => {
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

    const sampleData = [
      [
        "ORD-001",
        "John Doe",
        "john.doe@example.com",
        "+1-416-555-0123",
        "123 Main St, Toronto, ON M5V 3A8",
        "456 Queen St W, Toronto, ON M5V 2A9",
        "normal",
        "Ring doorbell twice",
      ],
      [
        "ORD-002",
        "Jane Smith",
        "jane.smith@example.com",
        "416-555-0124",
        "789 King St E, Toronto, ON M5A 1M2",
        "321 Spadina Ave, Toronto, ON M5T 2E7",
        "high",
        "Leave at front desk",
      ],
      [
        "ORD-003",
        "Bob Johnson",
        "bob.johnson@example.com",
        "(416) 555-0125",
        "555 Bay St, Toronto, ON M5G 2C2",
        "777 Yonge St, Toronto, ON M4Y 2B6",
        "urgent",
        "Fragile items - handle with care",
      ],
    ]

    const csv = [
      headers.join(","),
      ...sampleData.map((row) =>
        row
          .map((cell) =>
            // Wrap in quotes if contains comma, quote, or newline
            /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
          )
          .join(","),
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "order-import-template.csv"
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const generateBlankTemplate = () => {
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

    const csv = headers.join(",") + "\n"

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "blank-order-template.csv"
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CSV Template
        </CardTitle>
        <CardDescription>Download a template file to ensure your CSV is formatted correctly</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Required fields:</strong> order_number, customer_name, pickup_address, delivery_address
            <br />
            <strong>Priority values:</strong> low, normal, high, urgent
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Button onClick={generateTemplate} className="w-full bg-transparent" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download Template with Sample Data
          </Button>

          <Button onClick={generateBlankTemplate} className="w-full bg-transparent" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download Blank Template
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Supported file formats:</strong> CSV (.csv)
          </p>
          <p>
            <strong>Header variations supported:</strong>
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Order Number: order_number, order_no, order_id</li>
            <li>Customer Name: customer_name, name, customer</li>
            <li>Email: customer_email, email, email_address</li>
            <li>Phone: customer_phone, phone, phone_number</li>
            <li>Pickup: pickup_address, pickup, origin</li>
            <li>Delivery: delivery_address, delivery, destination, address</li>
            <li>Priority: priority (low/normal/high/urgent)</li>
            <li>Notes: delivery_notes, notes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
