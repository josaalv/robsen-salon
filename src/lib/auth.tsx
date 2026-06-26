import React, { createContext, useContext, useState } from 'react'
import type { Usuario } from '../types'
import { db } from './db'

interface AuthCtx {
  user: Usuario | null
  loading: boolean
  login: (u: Usuario) => void
  logout: () => void
  refreshUser: (id: string) => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: false,
  login: () => {}, logout: () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => {
    try { return JSON.parse(localStorage.getItem('rb_user') || 'null') }
    catch { return null }
  })
  const [loading, setLoading] = useState(false)

  const login = (u: Usuario) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pass: _p, ...safeUser } = u
    localStorage.setItem('rb_user', JSON.stringify(safeUser))
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('rb_user')
    setUser(null)
  }

  const refreshUser = async (id: string) => {
    setLoading(true)
    try {
      const fresh = await db.getUsuarioById(id)
      if (fresh) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { pass: _p, ...safeUser } = fresh
        localStorage.setItem('rb_user', JSON.stringify(safeUser))
        setUser(fresh)
      }
    } catch (e) {
      console.error('[auth.refreshUser]', e)
    } finally {
      setLoading(false)
    }
  }

  return <Ctx.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
