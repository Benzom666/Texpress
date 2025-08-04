import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Use service role key to bypass RLS completely
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    console.log("🔍 Fetching profile for user:", userId)

    // Try to get existing profile
    const { data: profile, error } = await supabase.from("user_profiles").select("*").eq("user_id", userId).single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("❌ Error fetching profile:", error)

      // If there's an error other than "not found", try to create a basic profile
      const { data: newProfile, error: createError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          email: `user-${userId}@example.com`, // Temporary email
          role: "admin",
          first_name: "",
          last_name: "",
        })
        .select()
        .single()

      if (createError) {
        console.error("❌ Error creating profile:", createError)
        // Return fallback profile
        return NextResponse.json({
          profile: {
            id: userId,
            user_id: userId,
            email: `user-${userId}@example.com`,
            role: "admin",
            first_name: "",
            last_name: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })
      }

      return NextResponse.json({ profile: newProfile })
    }

    if (!profile) {
      // Profile doesn't exist, create one
      console.log("📝 Creating new profile for user:", userId)

      const { data: newProfile, error: createError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          email: `user-${userId}@example.com`, // Temporary email
          role: "admin",
          first_name: "",
          last_name: "",
        })
        .select()
        .single()

      if (createError) {
        console.error("❌ Error creating new profile:", createError)
        // Return fallback profile
        return NextResponse.json({
          profile: {
            id: userId,
            user_id: userId,
            email: `user-${userId}@example.com`,
            role: "admin",
            first_name: "",
            last_name: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })
      }

      return NextResponse.json({ profile: newProfile })
    }

    console.log("✅ Profile found:", profile)
    return NextResponse.json({ profile })
  } catch (error) {
    console.error("❌ Error in get-profile API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
