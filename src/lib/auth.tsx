import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Usuario } from '../types'
import { db } from './db'
import { supabase } from './supabase'

interface AuthCtx {
  user: Usuario | null
  loading: boolean
  passwordRecovery: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  clearPasswordRecovery: () => void
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true, passwordRecovery: false,
  logout: async () => {}, refreshUser: async () => {}, clearPasswordRecovery: () => {},
})

// Limpia cachés locales que no deben sobrevivir a un cambio de sesión
// (evita que en un equipo compartido queden datos de la persona anterior).
function clearLocalCaches() {
  try {
    localStorage.removeItem('rb_data_v3')
    localStorage.removeItem('rb_notif_leidas')
    localStorage.removeItem('rb_wa_contactados')
  } catch { /* localStorage no disponible */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const loadProfile = async (authUserId: string) => {
    const profile = await db.getUsuarioByAuthId(authUserId)
    if (profile && profile.activo) {
      setUser(profile)
    } else {
      // Sin perfil vinculado o cuenta desactivada: no hay acceso operativo.
      setUser(null)
      await supabase?.auth.signOut()
      clearLocalCaches()
    }
  }

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (uid) loadProfile(uid).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); return }
      if (event === 'SIGNED_OUT') { setUser(null); return }
      if (session?.user) loadProfile(session.user.id)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase?.auth.signOut()
    setUser(null)
    clearLocalCaches()
  }

  const refreshUser = async () => {
    const { data } = (await supabase?.auth.getSession()) || {}
    const uid = data?.session?.user?.id
    if (uid) await loadProfile(uid)
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)

  return (
    <Ctx.Provider value={{ user, loading, passwordRecovery, logout, refreshUser, clearPasswordRecovery }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
