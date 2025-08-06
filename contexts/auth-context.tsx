"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { supabaseClient } from "@/lib/supabase-client"
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
      if (!supabaseClient) {
        const error = new Error("Supabase client is not available. Please check environment variables.")
        return { error }
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
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
        if (!supabaseClient) {
          if (mounted) {
            setLoading(false)
            setInitialized(true)
          }
          return
        }

        const {
          data: { session },
          error,
        } = await supabaseClient.auth.getSession()

        if (error) {
          console.error("Auth session error:", error)
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
        console.error("Auth initialization error:", error)
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initializeAuth()

    if (!supabaseClient) {
      return () => {
        mounted = false
      }
    }

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
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
  }, [])

  const signOut = async () => {
    try {
      if (!supabaseClient) {
        throw new Error("Supabase client is not available")
      }
      
      const { error } = await supabaseClient.auth.signOut()
      if (error) {
        throw error
      }
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error("Sign out error:", error)
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
