/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
// El build de preview usa el mismo proyecto de Supabase que producción, pero
// un schema aparte ('preview', clon aislado de 'public') — así no hace falta
// un segundo proyecto ni credenciales distintas. Vacío = 'public' (default).
const supabaseSchema = import.meta.env.VITE_SUPABASE_SCHEMA || undefined

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, supabaseSchema ? { db: { schema: supabaseSchema } } : undefined)
  : null

export const hasSupabase = Boolean(supabase)
