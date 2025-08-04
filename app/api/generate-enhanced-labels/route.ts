import { type NextRequest, NextResponse } from "next/server"
import { enhancedLabelGenerator, type EnhancedLabelData, type LabelOptions } from "@/lib/enhanced-label-generator"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { labelData, options }: { labelData: EnhancedLabelData[]; options: LabelOptions } = body

    if (!labelData || !Array.isArray(labelData) || labelData.length === 0) {
      return NextResponse.json({ error: "Label data is required and must be a non-empty array" }, { status: 400 })
    }

    if (!options) {
      return NextResponse.json({ error: "Label options are required" }, { status: 400 })
    }

    console.log(`🏷️ Generating ${labelData.length} enhanced labels`)

    // Generate labels (this would typically return a PDF or print directly)
    await enhancedLabelGenerator.printEnhancedLabels(labelData, options)

    return NextResponse.json({
      success: true,
      message: `Generated ${labelData.length} enhanced shipping labels`,
      labelCount: labelData.length,
    })
  } catch (error) {
    console.error("❌ Enhanced label generation error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate enhanced labels",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("adminId")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    // Load saved label templates
    const templates = enhancedLabelGenerator.loadLabelTemplates(adminId)

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    console.error("❌ Error loading label templates:", error)
    return NextResponse.json({ error: "Failed to load label templates" }, { status: 500 })
  }
}
