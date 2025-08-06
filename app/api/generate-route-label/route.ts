import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { routeId, labelType = 'complete', format = 'html', includeOrderLabels = true, includeRouteInfo = true } = await request.json()

    if (!routeId) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 })
    }

    // Fetch route data
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .single()

    if (routeError || !route) {
      console.error('Error fetching route:', routeError)
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    // Fetch route stops with order information
    const { data: routeStops, error: stopsError } = await supabase
      .from('route_stops')
      .select(`
        *,
        orders (
          id,
          order_number,
          customer_name,
          delivery_address,
          phone,
          special_instructions,
          status
        )
      `)
      .eq('route_id', routeId)
      .order('sequence_order')

    if (stopsError) {
      console.error('Error fetching route stops:', stopsError)
      return NextResponse.json({ error: 'Failed to fetch route stops' }, { status: 500 })
    }

    // Fetch driver information separately if driver_id exists
    let driver = null
    if (route.driver_id) {
      const { data: driverData, error: driverError } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('id', route.driver_id)
        .single()

      if (!driverError && driverData) {
        driver = driverData
      }
    }

    // Generate HTML labels
    const html = generateHTMLLabels(route, routeStops || [], driver, {
      labelType,
      includeOrderLabels,
      includeRouteInfo
    })

    const filename = `route-${route.route_number}-${labelType}.html`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Error generating route labels:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function generateHTMLLabels(route: any, routeStops: any[], driver: any, options: any) {
  const { labelType, includeOrderLabels, includeRouteInfo } = options

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Route Labels - ${route.route_number}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
        }
        .page-break {
            page-break-after: always;
        }
        .route-header {
            text-align: center;
            border: 2px solid #000;
            padding: 20px;
            margin-bottom: 30px;
            background: #f8f9fa;
        }
        .route-number {
            font-size: 36px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .route-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }
        .info-section {
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 5px;
        }
        .info-label {
            font-weight: bold;
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 16px;
            color: #000;
        }
        .order-label {
            border: 2px solid #000;
            margin: 20px 0;
            padding: 20px;
            background: white;
            min-height: 300px;
        }
        .stop-number {
            background: #2563eb;
            color: white;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            float: right;
            margin-left: 20px;
        }
        .order-header {
            overflow: hidden;
            margin-bottom: 20px;
        }
        .order-number {
            font-size: 24px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
        }
        .customer-name {
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 15px;
        }
        .address {
            font-size: 16px;
            line-height: 1.4;
            margin-bottom: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-left: 4px solid #2563eb;
        }
        .instructions {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .signature-area {
            margin-top: 30px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        .signature-box {
            border: 1px solid #000;
            height: 60px;
            margin: 10px 0;
            position: relative;
        }
        .signature-label {
            position: absolute;
            top: -10px;
            left: 10px;
            background: white;
            padding: 0 5px;
            font-size: 12px;
            color: #666;
        }
        .barcode-placeholder {
            border: 1px dashed #ccc;
            height: 40px;
            margin: 10px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-size: 12px;
        }
        @media print {
            body { margin: 0; }
            .page-break { page-break-after: always; }
        }
    </style>
</head>
<body>
`

  // Route Summary Section
  if (includeRouteInfo && (labelType === 'complete' || labelType === 'route_summary')) {
    html += `
    <div class="route-header">
        <div class="route-number">${route.route_number}</div>
        <h2>${route.route_name || 'Delivery Route'}</h2>
        
        <div class="route-info">
            <div class="info-section">
                <div class="info-label">Driver</div>
                <div class="info-value">${driver ? `${driver.first_name} ${driver.last_name}` : 'Unassigned'}</div>
            </div>
            <div class="info-section">
                <div class="info-label">Total Stops</div>
                <div class="info-value">${routeStops.length}</div>
            </div>
            <div class="info-section">
                <div class="info-label">Distance</div>
                <div class="info-value">${route.total_distance?.toFixed(1) || 0} km</div>
            </div>
            <div class="info-section">
                <div class="info-label">Est. Duration</div>
                <div class="info-value">${formatDuration(route.estimated_duration || 0)}</div>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <div class="info-label">Route Stops Overview</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">
                ${routeStops.map((stop, index) => `
                    <div style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">
                        <strong>Stop ${stop.sequence_order || index + 1}:</strong><br>
                        ${stop.orders?.customer_name || 'Unknown'}<br>
                        <small>${stop.orders?.order_number || 'No order'}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
`

    if (includeOrderLabels && labelType === 'complete') {
      html += '<div class="page-break"></div>'
    }
  }

  // Individual Order Labels
  if (includeOrderLabels && (labelType === 'complete' || labelType === 'order_labels')) {
    routeStops.forEach((stop, index) => {
      const order = stop.orders
      html += `
        <div class="order-label">
            <div class="order-header">
                <div class="stop-number">${stop.sequence_order || index + 1}</div>
                <div class="order-number">Order: ${order?.order_number || 'N/A'}</div>
                <div class="customer-name">${order?.customer_name || 'Unknown Customer'}</div>
            </div>
            
            <div class="address">
                <strong>Delivery Address:</strong><br>
                ${stop.address || order?.delivery_address || 'No address provided'}
            </div>

            ${order?.phone ? `
                <div style="margin: 10px 0;">
                    <strong>Phone:</strong> ${order.phone}
                </div>
            ` : ''}

            ${order?.special_instructions ? `
                <div class="instructions">
                    <strong>Special Instructions:</strong><br>
                    ${order.special_instructions}
                </div>
            ` : ''}

            <div class="barcode-placeholder">
                Barcode: ${order?.order_number || stop.id}
            </div>

            <div class="signature-area">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <div class="signature-box">
                            <div class="signature-label">Customer Signature</div>
                        </div>
                        <div style="text-align: center; font-size: 12px; margin-top: 5px;">
                            Date: _______________
                        </div>
                    </div>
                    <div>
                        <div class="signature-box">
                            <div class="signature-label">Driver Signature</div>
                        </div>
                        <div style="text-align: center; font-size: 12px; margin-top: 5px;">
                            Time: _______________
                        </div>
                    </div>
                </div>
            </div>
        </div>
        ${index < routeStops.length - 1 ? '<div class="page-break"></div>' : ''}
      `
    })
  }

  html += `
</body>
</html>
`

  return html
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}
