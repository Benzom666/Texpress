"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

interface UserProfile {
  id: string
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  role: "super_admin" | "admin" | "driver"
  phone?: string
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ data?: any; error?: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables")
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch("/api/get-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      return result.profile
    } catch (error) {
      console.error("Error fetching user profile via API:", error)
      return {
        id: userId,
        user_id: userId,
        email: user?.email || "",
        role: "admin" as const,
        first_name: "",
        last_name: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        const error = new Error("Supabase configuration is missing. Please check environment variables.")
        return { error }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        setUser(data.user)
        const userProfile = await fetchUserProfile(data.user.id)
        setProfile(userProfile)
      }

      return { data, error: null }
    } catch (err) {
      let errorMessage = "An unexpected error occurred during sign in"
      if (err instanceof Error) {
        errorMessage = err.message
      }
      return {
        error: {
          message: errorMessage,
          originalError: err,
        },
      }
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        if (!supabaseUrl || !supabaseAnonKey) {
          if (mounted) {
            setLoading(false)
            setInitialized(true)
          }
          return
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          if (mounted) {
            setLoading(false)
            setInitialized(true)
          }
          return
        }

        if (session?.user && mounted) {
          setUser(session.user)
          const userProfile = await fetchUserProfile(session.user.id)
          if (mounted) {
            setProfile(userProfile)
          }
        }

        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || !initialized) return

      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)
        const userProfile = await fetchUserProfile(session.user.id)
        if (mounted) {
          setProfile(userProfile)
        }
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabaseUrl, supabaseAnonKey])

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw error
      }
      setUser(null)
      setProfile(null)
    } catch (error) {
      throw error
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
