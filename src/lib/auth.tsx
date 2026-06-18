import React, { createContext, useContext, useState, useEffect } from 'react'
import type { Usuario } from '../types'

interface AuthCtx {
  user: Usuario | null
  login: (u: Usuario) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => {
    try { return JSON.parse(localStorage.getItem('rb_user') || 'null') }
    catch { return null }
  })

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

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
