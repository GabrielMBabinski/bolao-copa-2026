import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { auth, profiles } from '@/lib/supabaseClient'
import type { Profile } from '@/types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check initial session
    auth.getCurrentUser().then(({ user: currentUser }) => {
      setUser(currentUser)
      if (currentUser) {
        profiles.getProfile(currentUser.id).then(({ data }) => {
          setProfile(data)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        profiles.getProfile(session.user.id).then(({ data }) => {
          setProfile(data)
        })
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await auth.signIn(email, password)
    if (error) throw error
    setUser(data.user)
    if (data.user) {
      const { data: profileData } = await profiles.getProfile(data.user.id)
      setProfile(profileData)
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await auth.signUp(email, password, name)
    if (error) throw error
    setUser(data.user)
    if (data.user) {
      const { data: profileData } = await profiles.getProfile(data.user.id)
      setProfile(profileData)
    }
  }

  const signOut = async () => {
    const { error } = await auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
