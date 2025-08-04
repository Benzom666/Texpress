import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { userId, email, firstName, lastName, role } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: "User ID and email are required" }, { status: 400 })
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if profile already exists
    const { data: existingProfile } = await supabase.from("user_profiles").select("*").eq("user_id", userId).single()

    if (existingProfile) {
      return NextResponse.json({ profile: existingProfile })
    }

    // Create new profile
    const { data: newProfile, error } = await supabase
      .from("user_profiles")
      .insert({
        user_id: userId,
        email,
        first_name: firstName || "",
        last_name: lastName || "",
        role: role || "admin",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating profile:", error)
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
    }

    return NextResponse.json({ profile: newProfile })
  } catch (error) {
    console.error("Error in create-profile API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
