import { createClient } from '@supabase/supabase-js'
// La clave "anon" es pública: los datos los protegen las reglas RLS de la base de datos.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hvwfnzsbohqawqcbrgsj.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2d2ZuenNib2hxYXdxY2JyZ3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NTUxOTQsImV4cCI6MjExMDUzMTE5NH0.DR_eKJW-uw8K8fG6mWWq8xQgr2pbsRsKfnKbJO-Jjmg'
export const supabase = createClient(SUPABASE_URL, key)
