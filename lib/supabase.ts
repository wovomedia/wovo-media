import { createClient } from '@supabase/supabase-js'

// Browser client — uses cookies via @supabase/ssr for cross-device sessions
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'wovo-auth',
      // Use cookies not localStorage — sessions work on any device the user logs in from
      storage: {
        getItem: (key) => {
          if (typeof document === 'undefined') return null
          const cookies = document.cookie.split(';')
          const cookie = cookies.find(c => c.trim().startsWith(`${key}=`))
          if (!cookie) return null
          try { return decodeURIComponent(cookie.split('=').slice(1).join('=')) } catch { return null }
        },
        setItem: (key, value) => {
          if (typeof document === 'undefined') return
          // Secure, SameSite cookie — 7 day expiry
          const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
          document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax; Secure`
        },
        removeItem: (key) => {
          if (typeof document === 'undefined') return
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
        }
      }
    }
  }
)

export const roleRoutes: Record<string, string> = {
  owner: '/dashboard/owner',
  admin: '/dashboard/owner',
  content_manager: '/dashboard/team',
  customer_service: '/dashboard/team',
  employee: '/dashboard/team',
  client: '/dashboard/client',
}
