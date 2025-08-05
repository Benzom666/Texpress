import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

interface ParsedOrder {
  order_number: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  pickup_address: string
  delivery_address: string
  priority: string
  delivery_notes?: string
}

export async function POST(request: NextRequest) {
  try {
    console.log("📁 Starting file upload process...")

    const formData = await request.formData()
    const file = formData.get("file") as File
    const adminId = formData.get("adminId") as string

    if (!file) {
      console.log("❌ No file provided")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!adminId) {
      console.log("❌ No admin ID provided")
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    console.log("📁 Processing file:", file.name, "Size:", file.size, "Type:", file.type)

    // Validate file type
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]
    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith(".csv")) {
      console.log("❌ Invalid file type:", file.type)
      return NextResponse.json(
        {
          error: "Invalid file type. Please upload a CSV file.",
          debug: { fileType: file.type, fileName: file.name },
        },
        { status: 400 },
      )
    }

    // Read file content with error handling
    let fileContent: string
    try {
      fileContent = await file.text()
      console.log("📄 File content length:", fileContent.length)
    } catch (error) {
      console.error("❌ Error reading file:", error)
      return NextResponse.json(
        {
          error: "Failed to read file content. Please ensure the file is not corrupted.",
          debug: error instanceof Error ? error.message : "Unknown file read error",
        },
        { status: 400 },
      )
    }

    if (!fileContent.trim()) {
      console.log("❌ Empty file")
      return NextResponse.json({ error: "File is empty" }, { status: 400 })
    }

    // Parse CSV with better error handling
    const lines = fileContent.split(/\r?\n/).filter((line) => line.trim())
    console.log("📊 Total lines found:", lines.length)

    if (lines.length < 2) {
      return NextResponse.json(
        {
          error: "File must contain at least a header row and one data row",
          debug: { linesFound: lines.length, preview: lines.slice(0, 3) },
        },
        { status: 400 },
      )
    }

    // Parse header
    const headerLine = lines[0]
    let headers: string[]
    try {
      headers = parseCSVLine(headerLine)
      console.log("📋 Headers found:", headers)
    } catch (error) {
      console.error("❌ Error parsing header:", error)
      return NextResponse.json(
        {
          error: "Failed to parse CSV header row",
          debug: { headerLine, error: error instanceof Error ? error.message : "Unknown parse error" },
        },
        { status: 400 },
      )
    }

    // Validate required headers
    const requiredHeaders = ["order_number", "customer_name", "pickup_address", "delivery_address"]
    const headerMap = createHeaderMapping(headers)
    const missingHeaders = requiredHeaders.filter((header) => !(header in headerMap))

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required headers: ${missingHeaders.join(", ")}`,
          debug: {
            foundHeaders: headers,
            requiredHeaders,
            missingHeaders,
            headerMap,
          },
        },
        { status: 400 },
      )
    }

    console.log("🗺️ Header mapping:", headerMap)

    // Parse data rows
    const validOrders: ParsedOrder[] = []
    const validationErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = parseCSVLine(line)

        if (values.length === 0) {
          continue // Skip empty rows
        }

        const order: ParsedOrder = {
          order_number: getValueByHeader(values, headerMap, "order_number") || `ORD-${Date.now()}-${i}`,
          customer_name: getValueByHeader(values, headerMap, "customer_name") || "",
          customer_phone: getValueByHeader(values, headerMap, "customer_phone") || undefined,
          customer_email: getValueByHeader(values, headerMap, "customer_email") || undefined,
          pickup_address: getValueByHeader(values, headerMap, "pickup_address") || "",
          delivery_address: getValueByHeader(values, headerMap, "delivery_address") || "",
          priority: getValueByHeader(values, headerMap, "priority") || "normal",
          delivery_notes: getValueByHeader(values, headerMap, "delivery_notes") || undefined,
        }

        // Validate required fields
        const requiredFields: (keyof ParsedOrder)[] = [
          "order_number",
          "customer_name",
          "pickup_address",
          "delivery_address",
        ]
        const missingFields = requiredFields.filter((field) => !order[field] || (order[field] as string).trim() === "")

        if (missingFields.length > 0) {
          validationErrors.push(`Row ${i}: Missing required fields: ${missingFields.join(", ")}`)
          continue
        }

        // Validate and normalize priority
        const validPriorities = ["low", "normal", "high", "urgent"]
        const normalizedPriority = order.priority.toLowerCase().trim()
        if (!validPriorities.includes(normalizedPriority)) {
          order.priority = "normal"
          console.warn(`Row ${i}: Invalid priority '${order.priority}', defaulting to 'normal'`)
        } else {
          order.priority = normalizedPriority
        }

        // Validate email format if provided
        if (order.customer_email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(order.customer_email)) {
            console.warn(`Row ${i}: Invalid email format: ${order.customer_email}`)
            // Don't fail, just warn
          }
        }

        // Validate phone format if provided
        if (order.customer_phone) {
          const phoneRegex = /^(\+?1[-.\s]?)?($$?[0-9]{3}$$?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})$/
          if (!phoneRegex.test(order.customer_phone.replace(/\s/g, ""))) {
            console.warn(`Row ${i}: Invalid phone format: ${order.customer_phone}`)
            // Don't fail, just warn
          }
        }

        validOrders.push(order)
        console.log(`✅ Row ${i} parsed successfully:`, order.order_number)
      } catch (error) {
        console.error(`❌ Error parsing row ${i}:`, error)
        validationErrors.push(`Row ${i}: ${error instanceof Error ? error.message : "Parse error"}`)
      }
    }

    console.log(`📊 Parsing complete: ${validOrders.length} valid orders, ${validationErrors.length} errors`)

    if (validOrders.length === 0) {
      return NextResponse.json(
        {
          error: "No valid orders found in file",
          debug: {
            totalRows: lines.length - 1,
            validOrders: validOrders.length,
            validationErrors: validationErrors.slice(0, 10),
            headerMap,
            sampleRow: lines[1] ? parseCSVLine(lines[1]) : null,
          },
        },
        { status: 400 },
      )
    }

    // Insert orders into database
    const ordersToInsert = validOrders.map((order) => ({
      ...order,
      created_by: adminId,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    console.log("💾 Inserting orders into database:", ordersToInsert.length)

    const { data, error } = await supabase.from("orders").insert(ordersToInsert).select()

    if (error) {
      console.error("❌ Database insert error:", error)
      return NextResponse.json(
        {
          error: "Failed to insert orders into database",
          debug: {
            supabaseError: error.message,
            validOrders: validOrders.length,
            errorCode: error.code,
            errorDetails: error.details,
          },
        },
        { status: 500 },
      )
    }

    console.log("✅ Successfully inserted orders:", data?.length)

    return NextResponse.json({
      imported: data?.length || 0,
      total_processed: lines.length - 1,
      validation_errors: validationErrors.length > 0 ? validationErrors.slice(0, 10) : undefined,
      success: true,
    })
  } catch (error) {
    console.error("❌ Upload processing error:", error)

    // Always return JSON, never let it fall through to default error handling
    return NextResponse.json(
      {
        error: "Failed to process upload",
        debug: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          type: typeof error,
        },
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

function createHeaderMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}

  headers.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "_")

    // Map common variations
    if (cleanHeader.includes("order") && (cleanHeader.includes("number") || cleanHeader.includes("id"))) {
      mapping.order_number = index
    } else if (cleanHeader.includes("customer") && cleanHeader.includes("name")) {
      mapping.customer_name = index
    } else if (cleanHeader.includes("customer") && cleanHeader.includes("phone")) {
      mapping.customer_phone = index
    } else if (cleanHeader.includes("customer") && cleanHeader.includes("email")) {
      mapping.customer_email = index
    } else if (cleanHeader.includes("pickup") && cleanHeader.includes("address")) {
      mapping.pickup_address = index
    } else if (cleanHeader.includes("delivery") && cleanHeader.includes("address")) {
      mapping.delivery_address = index
    } else if (cleanHeader.includes("priority")) {
      mapping.priority = index
    } else if (cleanHeader.includes("delivery") && cleanHeader.includes("notes")) {
      mapping.delivery_notes = index
    } else if (cleanHeader.includes("notes") && !cleanHeader.includes("delivery")) {
      mapping.delivery_notes = index
    }

    // Additional mappings for common variations
    if (cleanHeader === "order_no" || cleanHeader === "order_id") {
      mapping.order_number = index
    }
    if (cleanHeader === "name" || cleanHeader === "customer") {
      mapping.customer_name = index
    }
    if (cleanHeader === "phone" || cleanHeader === "phone_number") {
      mapping.customer_phone = index
    }
    if (cleanHeader === "email" || cleanHeader === "email_address") {
      mapping.customer_email = index
    }
    if (cleanHeader === "pickup" || cleanHeader === "origin") {
      mapping.pickup_address = index
    }
    if (cleanHeader === "delivery" || cleanHeader === "destination" || cleanHeader === "address") {
      mapping.delivery_address = index
    }
  })

  return mapping
}

function getValueByHeader(values: string[], headerMap: Record<string, number>, key: string): string | undefined {
  const index = headerMap[key]
  if (index !== undefined && index < values.length) {
    const value = values[index]?.replace(/^"|"$/g, "").trim() // Remove quotes and trim
    return value || undefined
  }
  return undefined
}
