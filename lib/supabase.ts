import { createClient } from '@supabase/supabase-js'

// Single shared Supabase client - uses Supabase's default session storage
// Auth tokens are stored locally by design (this is standard for every web app)
// User DATA lives in the database, not locally
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
  owner: '/dashboard/owner',
  admin: '/dashboard/owner',
  content_manager: '/dashboard/team',
  customer_service: '/dashboard/team',
  employee: '/dashboard/team',
  client: '/dashboard/client',
}
