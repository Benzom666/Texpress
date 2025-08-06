import { supabase } from "./supabase"

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email?: string
  delivery_address: string
  priority: string
  route_number?: number
  stop_number?: number
  route_id?: string
}

interface LabelData {
  orderNumber: string
  customerName: string
  customerEmail: string
  deliveryAddress: string
  priority: string
  routeNumber?: string
  stopNumber?: string
  routeName?: string
  qrCode: string
  barcode: string
  createdDate: string
}

export async function generateBulkLabels(orders: Order[], download = true): Promise<void> {
  try {
    console.log(`Generating labels for ${orders.length} orders`)

    // Fetch route information for orders that have routes
    const ordersWithRoutes = orders.filter((order) => order.route_id)
    let routeData: Record<string, any> = {}

    if (ordersWithRoutes.length > 0) {
      const routeIds = [...new Set(ordersWithRoutes.map((order) => order.route_id))]
      const { data: routes, error } = await supabase
        .from("routes")
        .select("id, route_number, route_name")
        .in("id", routeIds)

      if (!error && routes) {
        routeData = routes.reduce(
          (acc, route) => {
            acc[route.id] = route
            return acc
          },
          {} as Record<string, any>,
        )
      }
    }

    // Generate label data for each order
    const labelDataArray: LabelData[] = orders.map((order) => {
      const route = order.route_id ? routeData[order.route_id] : null

      return {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email || "",
        deliveryAddress: order.delivery_address,
        priority: order.priority,
        routeNumber: route?.route_number?.toString() || order.route_number?.toString() || "",
        stopNumber: order.stop_number?.toString() || "",
        routeName: route?.route_name || "",
        qrCode: generateQRCodeData(order),
        barcode: generateBarcodeData(order),
        createdDate: new Date().toLocaleDateString(),
      }
    })

    // Generate the labels HTML
    const labelsHTML = generateLabelsHTML(labelDataArray)

    if (download) {
      // Create and download the labels
      downloadLabels(labelsHTML, `shipping-labels-${new Date().toISOString().split("T")[0]}.html`)
    } else {
      // Print the labels
      printLabels(labelsHTML)
    }

    console.log(`Successfully generated ${orders.length} labels`)
  } catch (error) {
    console.error("Error generating bulk labels:", error)
    throw new Error("Failed to generate labels")
  }
}

function generateQRCodeData(order: Order): string {
  // Generate QR code data with route and stop information
  const qrData = {
    orderNumber: order.order_number,
    customerId: order.customer_name,
    routeNumber: order.route_number || "",
    stopNumber: order.stop_number || "",
    timestamp: new Date().toISOString(),
  }
  return JSON.stringify(qrData)
}

function generateBarcodeData(order: Order): string {
  // Generate barcode with route and stop information
  const routePrefix = order.route_number ? `R${order.route_number.toString().padStart(4, "0")}` : ""
  const stopPrefix = order.stop_number ? `S${order.stop_number.toString().padStart(2, "0")}` : ""
  return `${routePrefix}${stopPrefix}${order.order_number}`
}

function generateLabelsHTML(labelDataArray: LabelData[]): string {
  const labelsPerRow = 2
  const labelsPerPage = 8

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Shipping Labels</title>
      <style>
        @page {
          size: A4;
          margin: 0.5in;
        }
        
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        
        .page {
          page-break-after: always;
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        
        .page:last-child {
          page-break-after: avoid;
        }
        
        .labels-container {
          display: grid;
          grid-template-columns: repeat(${labelsPerRow}, 1fr);
          gap: 0.25in;
          flex: 1;
        }
        
        .label {
          border: 2px solid #000;
          padding: 0.2in;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 3.5in;
          background: white;
        }
        
        .label-header {
          text-align: center;
          border-bottom: 1px solid #ccc;
          padding-bottom: 0.1in;
          margin-bottom: 0.1in;
        }
        
        .route-info {
          background: #f0f8ff;
          padding: 0.05in;
          border-radius: 3px;
          margin-bottom: 0.1in;
          text-align: center;
          font-weight: bold;
          color: #0066cc;
        }
        
        .order-number {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }
        
        .customer-info {
          margin: 0.1in 0;
        }
        
        .customer-name {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 0.05in;
        }
        
        .delivery-address {
          font-size: 12px;
          line-height: 1.3;
          margin-bottom: 0.1in;
        }
        
        .priority {
          display: inline-block;
          padding: 0.02in 0.05in;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
        }
        
        .priority-urgent {
          background: #ffebee;
          color: #c62828;
          border: 1px solid #c62828;
        }
        
        .priority-high {
          background: #fff3e0;
          color: #ef6c00;
          border: 1px solid #ef6c00;
        }
        
        .priority-normal {
          background: #e3f2fd;
          color: #1976d2;
          border: 1px solid #1976d2;
        }
        
        .priority-low {
          background: #f3e5f5;
          color: #7b1fa2;
          border: 1px solid #7b1fa2;
        }
        
        .codes-section {
          margin-top: auto;
          text-align: center;
          border-top: 1px solid #ccc;
          padding-top: 0.1in;
        }
        
        .barcode {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
          margin: 0.05in 0;
        }
        
        .qr-placeholder {
          width: 0.8in;
          height: 0.8in;
          border: 1px solid #ccc;
          margin: 0.05in auto;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          color: #666;
        }
        
        .label-footer {
          font-size: 8px;
          color: #666;
          text-align: center;
          margin-top: 0.05in;
        }
        
        @media print {
          .page {
            height: auto;
            min-height: 100vh;
          }
        }
      </style>
    </head>
    <body>
  `

  // Group labels into pages
  for (let pageIndex = 0; pageIndex < Math.ceil(labelDataArray.length / labelsPerPage); pageIndex++) {
    const pageLabels = labelDataArray.slice(pageIndex * labelsPerPage, (pageIndex + 1) * labelsPerPage)

    html += `<div class="page"><div class="labels-container">`

    pageLabels.forEach((labelData) => {
      const priorityClass = `priority-${labelData.priority.toLowerCase()}`
      const routeInfo =
        labelData.routeNumber && labelData.stopNumber
          ? `Route ${labelData.routeNumber} - Stop ${labelData.stopNumber}`
          : labelData.routeNumber
            ? `Route ${labelData.routeNumber}`
            : ""

      html += `
        <div class="label">
          <div class="label-header">
            <div class="order-number">#${labelData.orderNumber}</div>
            ${
              routeInfo
                ? `<div class="route-info">${routeInfo}${labelData.routeName ? ` (${labelData.routeName})` : ""}</div>`
                : ""
            }
          </div>
          
          <div class="customer-info">
            <div class="customer-name">${labelData.customerName}</div>
            <div class="delivery-address">${labelData.deliveryAddress}</div>
            <div class="priority ${priorityClass}">${labelData.priority}</div>
          </div>
          
          <div class="codes-section">
            <div class="qr-placeholder">QR Code</div>
            <div class="barcode">${labelData.barcode}</div>
          </div>
          
          <div class="label-footer">
            Generated: ${labelData.createdDate}
          </div>
        </div>
      `
    })

    html += `</div></div>`
  }

  html += `
    </body>
    </html>
  `

  return html
}

function downloadLabels(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

function printLabels(html: string): void {
  const printWindow = window.open("", "_blank")
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  }
}

export async function generateSingleLabel(order: Order, download = true): Promise<void> {
  return generateBulkLabels([order], download)
}
