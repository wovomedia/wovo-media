import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
)

export const roleRoutes: Record<string, string> = {
  owner: '/admin', admin: '/admin',
  content_manager: '/employee', customer_service: '/employee',
  employee: '/employee', client: '/home'
}
