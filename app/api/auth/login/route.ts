import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ROUTES: Record<string, string> = {
  owner: '/admin', admin: '/admin',
  content_manager: '/employee', customer_service: '/employee',
  employee: '/employee', client: '/home'
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  // Single Supabase call - sign in
  const { data, error } = await sb.auth.signInWithPassword({ email, password })

  if (error) return NextResponse.json({
    error: error.message.includes('Invalid login credentials')
      ? 'Incorrect email or password.' : error.message
  }, { status: 401 })

  // Get role - use user_metadata first (fastest, no extra DB call)
  let role = data.user.user_metadata?.wovo_role as string

  if (!role) {
    // Only hit DB if not in metadata
    const { data: profile } = await admin
      .from('profiles').select('wovo_role').eq('user_id', data.user.id).single()

    role = profile?.wovo_role || 'client'

    // Cache role in user metadata for next login (no DB call needed)
    await sb.auth.updateUser({ data: { wovo_role: role } }).catch(() => {})
  }

  return NextResponse.json({
    success: true,
    redirect: ROUTES[role] || '/home',
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
