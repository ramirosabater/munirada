import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) await loadProfile(session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // fuera del callback para no bloquear el cliente de Supabase
      setTimeout(() => { session?.user ? loadProfile(session.user.id) : setProfile(null) }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const role = profile?.role
  const value = {
    session,
    profile,
    loading,
    uid: session?.user?.id,
    isStaff: ['profesor', 'agente', 'admin'].includes(role),
    isGestor: ['agente', 'admin'].includes(role),
    isAdmin: role === 'admin',
    // ¿Puede gestionar (editar, cobrar) cosas de esta área?
    gestiona: area => role === 'admin' || (role === 'agente' && profile?.area === area),
    signOut: () => supabase.auth.signOut(),
    reloadProfile: () => session?.user && loadProfile(session.user.id),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
