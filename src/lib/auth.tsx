import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Usuario } from '../types'
import { db } from './db'
import { supabase } from './supabase'
import { STORAGE_SUFFIX } from './env'

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
    localStorage.removeItem('rb_data_v3' + STORAGE_SUFFIX)
    localStorage.removeItem('rb_notif_leidas')
    localStorage.removeItem('rb_wa_contactados')
    localStorage.removeItem(CACHED_PROFILE_KEY)
  } catch { /* localStorage no disponible */ }
}

// Perfil del último login exitoso, en su propia key — separada de rb_data_v3
// para que un corte de red al validar el perfil (no un "sin acceso" real)
// pueda usar este respaldo en vez de tirar a la persona al login teniendo ya
// una sesión válida guardada.
const CACHED_PROFILE_KEY = 'rb_cached_profile' + STORAGE_SUFFIX

function getCachedProfile(): Usuario | null {
  try {
    const raw = localStorage.getItem(CACHED_PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch { return null }
}

function setCachedProfile(u: Usuario) {
  try { localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(u)) } catch { /* localStorage no disponible */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const loadProfile = async (authUserId: string) => {
    let profile: Usuario | null
    try {
      profile = await db.getUsuarioByAuthId(authUserId)
    } catch {
      // No se pudo verificar el perfil (sin red, no "sin acceso" real) — usar
      // el último perfil confirmado en vez de tirar a la persona al login
      // teniendo ya una sesión válida guardada.
      const cached = getCachedProfile()
      if (cached) setUser(cached)
      return
    }
    if (profile && profile.activo) {
      setUser(profile)
      setCachedProfile(profile)
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
