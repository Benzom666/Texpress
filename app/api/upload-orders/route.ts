import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { geocodingService } from "@/lib/geocoding-service"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase configuration")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface OrderData {
  order_number: string
  customer_name: string
  customer_email?: string
  delivery_address: string
  pickup_address: string
  priority: "urgent" | "high" | "normal" | "low"
  status: string
  special_requirements?: string
  package_weight?: number
  delivery_window_start?: string
  delivery_window_end?: string
  created_by: string
  created_at: string
  updated_at: string
}

interface ValidationError {
  row: number
  field: string
  value: any
  message: string
}

export async function POST(request: NextRequest) {
  try {
    console.log("📤 Starting file upload process")

    const formData = await request.formData()
    const file = formData.get("file") as File
    const adminId = formData.get("adminId") as string
    const warehouseAddress = formData.get("warehouseAddress") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    const defaultPickupAddress = warehouseAddress || "Main Warehouse"

    console.log(`📁 Processing file: ${file.name} (${file.size} bytes)`)

    // Validate file type
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      return NextResponse.json({ error: "Invalid file type. Please upload a CSV or Excel file." }, { status: 400 })
    }

    // Read file content
    const buffer = await file.arrayBuffer()
    const text = new TextDecoder().decode(buffer)

    // Parse CSV
    const lines = text.split(/\r?\n/).filter((line) => line.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: "File must contain at least a header row and one data row" }, { status: 400 })
    }

    console.log(`📊 Found ${lines.length} lines in file`)

    // Parse header row
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine).map((header) =>
      header
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/^_+|_+$/g, ""),
    )

    console.log("📋 Headers found:", headers)

    // Create header mapping
    const headerMap: { [key: string]: number } = {}

    // Map common variations to standard field names
    const fieldMappings = {
      order_number: ["order_number", "order_no", "order_id", "ordernumber", "order", "number"],
      customer_name: ["customer_name", "customer", "name", "client_name", "recipient", "client"],
      customer_email: ["customer_email", "email", "customer_email_address", "email_address", "mail"],
      delivery_address: ["delivery_address", "address", "delivery_addr", "shipping_address", "location", "destination"],
      pickup_address: ["pickup_address", "pickup", "from_address", "origin", "origin_address"],
      priority: ["priority", "urgency", "importance", "priority_level", "level"],
      status: ["status", "order_status", "delivery_status", "state"],
      special_requirements: [
        "special_requirements",
        "notes",
        "instructions",
        "comments",
        "special_notes",
        "requirements",
      ],
      package_weight: ["package_weight", "weight", "pkg_weight", "item_weight", "mass"],
      delivery_window_start: [
        "delivery_window_start",
        "delivery_start",
        "window_start",
        "earliest_delivery",
        "start_time",
      ],
      delivery_window_end: ["delivery_window_end", "delivery_end", "window_end", "latest_delivery", "end_time"],
    }

    // Create mapping from headers to field names
    headers.forEach((header, index) => {
      for (const [standardField, variations] of Object.entries(fieldMappings)) {
        if (variations.includes(header)) {
          headerMap[standardField] = index
          break
        }
      }
    })

    console.log("🗺️ Header mapping:", headerMap)

    // Validate required fields
    const requiredFields = ["order_number", "customer_name", "delivery_address"]
    const missingFields = requiredFields.filter((field) => !(field in headerMap))

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingFields.join(", ")}`,
          missing_fields: missingFields,
          found_headers: headers,
          suggestion: "Required columns: Order Number, Customer Name, Delivery Address",
        },
        { status: 400 },
      )
    }

    // Process data rows
    const orders: OrderData[] = []
    const validationErrors: ValidationError[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = parseCSVLine(line)

        if (values.length === 0 || values.every((val) => !val || val.trim() === "")) {
          continue // Skip empty rows
        }

        console.log(`Processing row ${i + 1}:`, values)

        // Extract values using header mapping
        const orderData: Partial<OrderData> = {}

        // Get required fields
        const orderNumber = getValueByIndex(values, headerMap.order_number)
        const customerName = getValueByIndex(values, headerMap.customer_name)
        const deliveryAddress = getValueByIndex(values, headerMap.delivery_address)

        // Validate required fields
        if (!orderNumber || orderNumber.trim() === "") {
          validationErrors.push({
            row: i + 1,
            field: "order_number",
            value: orderNumber,
            message: "Order number is required",
          })
          continue
        }

        if (!customerName || customerName.trim() === "") {
          validationErrors.push({
            row: i + 1,
            field: "customer_name",
            value: customerName,
            message: "Customer name is required",
          })
          continue
        }

        if (!deliveryAddress || deliveryAddress.trim() === "") {
          validationErrors.push({
            row: i + 1,
            field: "delivery_address",
            value: deliveryAddress,
            message: "Delivery address is required",
          })
          continue
        }

        // Set required fields
        orderData.order_number = orderNumber.trim()
        orderData.customer_name = customerName.trim()
        orderData.delivery_address = deliveryAddress.trim()

        // Handle pickup_address
        const pickupAddress = getValueByIndex(values, headerMap.pickup_address)
        orderData.pickup_address = pickupAddress?.trim() || defaultPickupAddress

        // Set optional fields
        const customerEmail = getValueByIndex(values, headerMap.customer_email)
        if (customerEmail && customerEmail.trim() !== "") {
          if (customerEmail.includes("@")) {
            orderData.customer_email = customerEmail.trim()
          } else {
            validationErrors.push({
              row: i + 1,
              field: "customer_email",
              value: customerEmail,
              message: "Invalid email format",
            })
          }
        }

        // Handle priority with safe access
        const priorityValue = getValueByIndex(values, headerMap.priority)
        orderData.priority = validatePriority(priorityValue)

        // Handle special requirements
        const specialReqs = getValueByIndex(values, headerMap.special_requirements)
        if (specialReqs && specialReqs.trim() !== "") {
          orderData.special_requirements = specialReqs.trim()
        }

        // Handle package weight
        const weightValue = getValueByIndex(values, headerMap.package_weight)
        if (weightValue && weightValue.trim() !== "") {
          const weight = Number.parseFloat(weightValue)
          if (!isNaN(weight) && weight > 0) {
            orderData.package_weight = weight
          } else {
            validationErrors.push({
              row: i + 1,
              field: "package_weight",
              value: weightValue,
              message: "Invalid weight value",
            })
          }
        }

        // Handle delivery windows
        const windowStart = getValueByIndex(values, headerMap.delivery_window_start)
        if (windowStart && windowStart.trim() !== "") {
          orderData.delivery_window_start = windowStart.trim()
        }

        const windowEnd = getValueByIndex(values, headerMap.delivery_window_end)
        if (windowEnd && windowEnd.trim() !== "") {
          orderData.delivery_window_end = windowEnd.trim()
        }

        // Set system fields
        orderData.status = "pending"
        orderData.created_by = adminId
        orderData.created_at = new Date().toISOString()
        orderData.updated_at = new Date().toISOString()

        orders.push(orderData as OrderData)
        console.log(`✅ Row ${i + 1} processed successfully`)
      } catch (rowError) {
        console.error(`❌ Error processing row ${i + 1}:`, rowError)
        validationErrors.push({
          row: i + 1,
          field: "general",
          value: line,
          message: `Failed to process row: ${rowError instanceof Error ? rowError.message : "Unknown error"}`,
        })
      }
    }

    console.log(`✅ Processed ${orders.length} valid orders`)
    console.log(`⚠️ Found ${validationErrors.length} validation errors`)

    if (orders.length === 0) {
      return NextResponse.json(
        {
          error: "No valid orders found in file",
          validation_errors: validationErrors.slice(0, 10), // Limit to first 10 errors
          total_errors: validationErrors.length,
        },
        { status: 400 },
      )
    }

    // Insert orders into database
    console.log("💾 Inserting orders into database...")
    const { data: insertedOrders, error: insertError } = await supabase.from("orders").insert(orders).select()

    if (insertError) {
      console.error("❌ Database insert error:", insertError)
      return NextResponse.json(
        {
          error: "Failed to save orders to database",
          details: insertError.message,
          code: insertError.code,
        },
        { status: 500 },
      )
    }

    const successCount = insertedOrders?.length || 0

    console.log(`✅ Successfully uploaded ${successCount} orders`)

    // Geocode addresses for route optimization
    console.log("🗺️ Starting geocoding process for uploaded orders...")

    let geocodedCount = 0
    const geocodingErrors: string[] = []

    for (const order of insertedOrders) {
      try {
        if (order.delivery_address) {
          const geocodeResult = await geocodingService.geocodeAddress(order.delivery_address)

          if (geocodeResult.coordinates) {
            // Update order with coordinates
            const { error: updateError } = await supabase
              .from("orders")
              .update({
                coordinates: geocodeResult.coordinates,
                geocoded_at: new Date().toISOString(),
              })
              .eq("id", order.id)

            if (!updateError) {
              geocodedCount++
              console.log(
                `✅ Geocoded: ${order.delivery_address} -> [${geocodeResult.coordinates[0]}, ${geocodeResult.coordinates[1]}]`,
              )
            } else {
              console.error(`❌ Error updating coordinates for order ${order.id}:`, updateError)
              geocodingErrors.push(`Failed to save coordinates for order ${order.order_number}`)
            }
          } else {
            console.warn(`⚠️ No coordinates found for address: ${order.delivery_address}`)
            geocodingErrors.push(`Could not geocode address: ${order.delivery_address}`)
          }
        }
      } catch (geocodeError) {
        console.error(`❌ Geocoding error for order ${order.id}:`, geocodeError)
        geocodingErrors.push(`Geocoding failed for order ${order.order_number}`)
      }
    }

    console.log(`✅ Geocoding completed: ${geocodedCount}/${insertedOrders.length} orders geocoded`)

    return NextResponse.json({
      success: true,
      imported: successCount,
      geocoded: geocodedCount,
      total_processed: lines.length - 1,
      validation_errors: validationErrors.length > 0 ? validationErrors.slice(0, 10) : [],
      geocoding_errors: geocodingErrors.length > 0 ? geocodingErrors.slice(0, 10) : [],
      total_validation_errors: validationErrors.length,
      total_geocoding_errors: geocodingErrors.length,
      message: `Successfully imported ${successCount} orders (${geocodedCount} geocoded and ready for route optimization)`,
    })
  } catch (error) {
    console.error("❌ Upload error:", error)
    return NextResponse.json(
      {
        error: "Failed to process upload",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  // Add the last field
  result.push(current.trim())

  return result
}

function getValueByIndex(values: string[], index: number | undefined): string | undefined {
  if (index === undefined || index < 0 || index >= values.length) {
    return undefined
  }
  const value = values[index]
  if (!value || value.trim() === "") {
    return undefined
  }
  return value.replace(/^"|"$/g, "").trim() // Remove surrounding quotes
}

function validatePriority(priority: string | undefined): "urgent" | "high" | "normal" | "low" {
  if (!priority || typeof priority !== "string") {
    return "normal"
  }

  const normalizedPriority = priority.toLowerCase().trim()

  switch (normalizedPriority) {
    case "urgent":
    case "1":
    case "critical":
    case "emergency":
      return "urgent"
    case "high":
    case "2":
    case "important":
      return "high"
    case "normal":
    case "3":
    case "medium":
    case "standard":
    case "regular":
      return "normal"
    case "low":
    case "4":
    case "low priority":
      return "low"
    default:
      return "normal"
  }
}
