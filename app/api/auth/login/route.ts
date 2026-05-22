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
    const msg = error.message.includes('Invalid login credentials')
      ? 'Incorrect email or password.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  // Get or create profile
  const adminSb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let { data: profile } = await adminSb
    .from('profiles')
    .select('wovo_role')
    .eq('user_id', data.user.id)
    .single()

  if (!profile) {
    await adminSb.from('profiles').insert({
      user_id: data.user.id,
      wovo_role: 'client',
      full_name: data.user.user_metadata?.full_name || ''
    })
    profile = { wovo_role: 'client' }
  }

  const roleRoutes: Record<string, string> = {
    owner: '/dashboard/owner',
    admin: '/dashboard/owner',
    content_manager: '/dashboard/team',
    customer_service: '/dashboard/team',
    employee: '/dashboard/team',
    client: '/dashboard/client'
  }

  const redirect = roleRoutes[profile.wovo_role] || '/dashboard/client'
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
  const sessionValue = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email }
  })

  const response = NextResponse.json({ success: true, redirect })

  // Set session as a secure cookie — works on any device they log in from
  response.cookies.set('wovo-auth', sessionValue, {
    httpOnly: false, // needs to be readable by Supabase client
    secure: true,
    sameSite: 'lax',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    path: '/',
  })

  // Also set the Supabase-specific cookie key so it auto-picks up the session
  const supabaseKey = `wovo-auth`
  response.cookies.set(supabaseKey, sessionValue, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    path: '/',
  })

  return response
}
