import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'wovo-auth',
  }
})

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const getProfile = async (userId: string) => {
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
  return data
}

export const roleRoutes: Record<string, string> = {
  owner: '/dashboard/owner',
  admin: '/dashboard/owner',
  content_manager: '/dashboard/team',
  customer_service: '/dashboard/team',
  employee: '/dashboard/team',
  client: '/dashboard/client',
}
