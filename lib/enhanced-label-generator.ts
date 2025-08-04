export interface EnhancedLabelData {
  order: {
    id: string
    order_number: string
    customer_name: string
    customer_phone?: string
    customer_email?: string
    delivery_address: string
    priority: string
    status: string
    created_at: string
    delivery_notes?: string
  }
  route: {
    route_number: number
    stop_number: number
    estimated_arrival: string
    driver_id?: string
    driver_name?: string
    total_stops: number
    color: string
  }
  coordinates?: [number, number]
}

export interface LabelOptions {
  includeQR: boolean
  includeBarcode: boolean
  includeRouteInfo: boolean
  includeDriverInfo: boolean
  labelSize: "small" | "medium" | "large"
  theme: "standard" | "minimal" | "detailed"
}

class EnhancedLabelGenerator {
  private generateQRCode(data: string): string {
    // Generate QR code data URL using a simple implementation
    // In a real implementation, you'd use a QR code library
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) return ""

    canvas.width = 100
    canvas.height = 100

    // Simple placeholder QR code pattern
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, 100, 100)
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(10, 10, 80, 80)
    ctx.fillStyle = "#000000"

    // Create a simple pattern
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(10 + i * 8, 10 + j * 8, 8, 8)
        }
      }
    }

    return canvas.toDataURL()
  }

  private generateBarcode(data: string): string {
    // Generate barcode data URL using a simple implementation
    // In a real implementation, you'd use a barcode library
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) return ""

    canvas.width = 200
    canvas.height = 50

    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, 200, 50)
    ctx.fillStyle = "#000000"

    // Simple barcode pattern
    for (let i = 0; i < 40; i++) {
      const width = Math.random() > 0.5 ? 2 : 4
      if (i % 2 === 0) {
        ctx.fillRect(i * 5, 10, width, 30)
      }
    }

    return canvas.toDataURL()
  }

  private formatAddress(address: string): string[] {
    // Split address into multiple lines for better formatting
    const parts = address.split(",").map((part) => part.trim())
    const lines: string[] = []

    if (parts.length <= 2) {
      return [address]
    }

    // First line: street address
    lines.push(parts[0])

    // Second line: city, province, postal code
    if (parts.length > 1) {
      lines.push(parts.slice(1).join(", "))
    }

    return lines
  }

  private getPriorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case "urgent":
        return "#DC2626"
      case "high":
        return "#EA580C"
      case "normal":
        return "#2563EB"
      case "low":
        return "#6B7280"
      default:
        return "#6B7280"
    }
  }

  private generateLabelHTML(labelData: EnhancedLabelData, options: LabelOptions): string {
    const { order, route, coordinates } = labelData
    const addressLines = this.formatAddress(order.delivery_address)
    const priorityColor = this.getPriorityColor(order.priority)

    const qrCodeData = options.includeQR
      ? JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          routeNumber: route.route_number,
          stopNumber: route.stop_number,
          coordinates: coordinates,
        })
      : ""

    const qrCodeUrl = options.includeQR ? this.generateQRCode(qrCodeData) : ""
    const barcodeUrl = options.includeBarcode ? this.generateBarcode(order.order_number) : ""

    const sizeClasses = {
      small: "w-[4in] h-[3in]",
      medium: "w-[4in] h-[6in]",
      large: "w-[6in] h-[4in]",
    }

    return `
      <div class="label-container ${sizeClasses[options.labelSize]} bg-white border-2 border-gray-300 p-4 font-sans text-black relative">
        <!-- Header -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h1 class="text-lg font-bold text-gray-800">DeliveryOS</h1>
            <div class="text-sm text-gray-600">Shipping Label</div>
          </div>
          ${
            options.includeQR && qrCodeUrl
              ? `
            <div class="w-16 h-16">
              <img src="${qrCodeUrl}" alt="QR Code" class="w-full h-full" />
            </div>
          `
              : ""
          }
        </div>

        <!-- Order Information -->
        <div class="mb-4">
          <div class="flex justify-between items-center mb-2">
            <div class="text-xl font-bold">${order.order_number}</div>
            <div class="px-2 py-1 rounded text-xs font-medium text-white" style="background-color: ${priorityColor}">
              ${order.priority.toUpperCase()}
            </div>
          </div>
          <div class="text-sm text-gray-600">
            Order Date: ${new Date(order.created_at).toLocaleDateString()}
          </div>
        </div>

        <!-- Route Information -->
        ${
          options.includeRouteInfo
            ? `
          <div class="mb-4 p-2 bg-gray-50 rounded">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-3 h-3 rounded-full" style="background-color: ${route.color}"></div>
              <span class="font-medium">Route ${route.route_number}</span>
              <span class="text-sm text-gray-600">Stop ${route.stop_number} of ${route.total_stops}</span>
            </div>
            <div class="text-xs text-gray-600">
              ETA: ${new Date(route.estimated_arrival).toLocaleString()}
            </div>
          </div>
        `
            : ""
        }

        <!-- Customer Information -->
        <div class="mb-4">
          <div class="text-lg font-semibold mb-1">${order.customer_name}</div>
          ${order.customer_phone ? `<div class="text-sm text-gray-600">${order.customer_phone}</div>` : ""}
          ${order.customer_email ? `<div class="text-sm text-gray-600">${order.customer_email}</div>` : ""}
        </div>

        <!-- Delivery Address -->
        <div class="mb-4">
          <div class="font-medium text-gray-800 mb-1">DELIVER TO:</div>
          <div class="border-l-4 border-blue-500 pl-3">
            ${addressLines.map((line) => `<div class="text-sm">${line}</div>`).join("")}
          </div>
        </div>

        <!-- Driver Information -->
        ${
          options.includeDriverInfo && route.driver_name
            ? `
          <div class="mb-4 p-2 bg-blue-50 rounded">
            <div class="text-sm font-medium text-blue-800">Driver: ${route.driver_name}</div>
          </div>
        `
            : ""
        }

        <!-- Delivery Notes -->
        ${
          order.delivery_notes
            ? `
          <div class="mb-4">
            <div class="text-sm font-medium text-gray-800 mb-1">Special Instructions:</div>
            <div class="text-xs text-gray-600 bg-yellow-50 p-2 rounded">
              ${order.delivery_notes}
            </div>
          </div>
        `
            : ""
        }

        <!-- Barcode -->
        ${
          options.includeBarcode && barcodeUrl
            ? `
          <div class="absolute bottom-2 left-4 right-4">
            <img src="${barcodeUrl}" alt="Barcode" class="w-full h-8" />
            <div class="text-center text-xs mt-1">${order.order_number}</div>
          </div>
        `
            : ""
        }

        <!-- Coordinates (for debugging) -->
        ${
          coordinates && options.theme === "detailed"
            ? `
          <div class="absolute bottom-2 right-4 text-xs text-gray-400">
            ${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}
          </div>
        `
            : ""
        }
      </div>
    `
  }

  async printEnhancedLabels(labelDataArray: EnhancedLabelData[], options: LabelOptions): Promise<void> {
    try {
      // Create a new window for printing
      const printWindow = window.open("", "_blank", "width=800,height=600")

      if (!printWindow) {
        throw new Error("Unable to open print window. Please check popup blockers.")
      }

      // Generate HTML for all labels
      const labelsHTML = labelDataArray
        .map((labelData) => this.generateLabelHTML(labelData, options))
        .join('<div class="page-break"></div>')

      // Create the complete HTML document
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Enhanced Shipping Labels</title>
          <meta charset="utf-8">
          <style>
            @media print {
              body { margin: 0; }
              .page-break { page-break-before: always; }
              .label-container { 
                margin: 0; 
                box-shadow: none !important;
                border: 1px solid #000 !important;
              }
            }
            
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background: #f5f5f5;
            }
            
            .label-container {
              background: white;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              page-break-inside: avoid;
            }
            
            @page {
              margin: 0.5in;
            }
          </style>
        </head>
        <body>
          ${labelsHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            }
          </script>
        </body>
        </html>
      `

      // Write content to print window
      printWindow.document.write(htmlContent)
      printWindow.document.close()

      console.log(`✅ Generated ${labelDataArray.length} enhanced shipping labels`)
    } catch (error) {
      console.error("❌ Failed to generate enhanced labels:", error)
      throw error
    }
  }

  async generateLabelPDF(labelDataArray: EnhancedLabelData[], options: LabelOptions): Promise<Blob> {
    // This would integrate with a PDF generation library like jsPDF
    // For now, we'll return a placeholder
    const htmlContent = labelDataArray.map((labelData) => this.generateLabelHTML(labelData, options)).join("\n\n")

    return new Blob([htmlContent], { type: "text/html" })
  }

  async saveLabelTemplate(name: string, options: LabelOptions, adminId: string): Promise<void> {
    try {
      // Save label template to database or local storage
      const template = {
        name,
        options,
        created_by: adminId,
        created_at: new Date().toISOString(),
      }

      localStorage.setItem(`label-template-${name}`, JSON.stringify(template))
      console.log(`✅ Saved label template: ${name}`)
    } catch (error) {
      console.error("❌ Failed to save label template:", error)
      throw error
    }
  }

  loadLabelTemplates(adminId: string): Array<{ name: string; options: LabelOptions }> {
    try {
      const templates: Array<{ name: string; options: LabelOptions }> = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("label-template-")) {
          const templateData = localStorage.getItem(key)
          if (templateData) {
            const template = JSON.parse(templateData)
            if (template.created_by === adminId) {
              templates.push({
                name: template.name,
                options: template.options,
              })
            }
          }
        }
      }

      return templates
    } catch (error) {
      console.error("❌ Failed to load label templates:", error)
      return []
    }
  }
}

export const enhancedLabelGenerator = new EnhancedLabelGenerator()
