import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await sb.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({
      error: error.message.includes('Invalid login credentials')
        ? 'Incorrect email or password.'
        : error.message
    }, { status: 401 })
  }

  // Get or create profile
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let { data: profile } = await admin
    .from('profiles').select('wovo_role').eq('user_id', data.user.id).single()

  if (!profile) {
    await admin.from('profiles').insert({
      user_id: data.user.id,
      wovo_role: 'client',
      full_name: data.user.user_metadata?.full_name || ''
    })
    profile = { wovo_role: 'client' }
  }

  const routes: Record<string, string> = {
    owner: '/dashboard/owner', admin: '/dashboard/owner',
    content_manager: '/dashboard/team', customer_service: '/dashboard/team',
    employee: '/dashboard/team', client: '/dashboard/client'
  }

  return NextResponse.json({
    success: true,
    redirect: routes[profile.wovo_role] || '/dashboard/client',
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
