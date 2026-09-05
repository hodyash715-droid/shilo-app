import { createClient } from '@supabase/supabase-js'

// הערכים מגיעים מ-.env בזמן build (Vite). המפתח הוא ה-anon/publishable
// הציבורי בלבד — מוגן על ידי RLS ב-Supabase, ולכן מותר שיהיה בקוד.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key)

export const supabase = isConfigured ? createClient(url, key) : null
