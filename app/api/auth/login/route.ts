import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  
  // Use anon client for actual auth (service role bypasses password check)
  const anonSb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const { data, error } = await anonSb.auth.signInWithPassword({ email, password })
  if (error) {
    const msg = error.message.includes('Invalid login') ? 'Incorrect email or password.' : error.message
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  // Get role
  const { data: profile } = await sb.from('profiles').select('wovo_role, full_name').eq('user_id', data.user.id).single()
  
  // If no profile, create one
  if (!profile) {
    await sb.from('profiles').insert({
      user_id: data.user.id,
      wovo_role: 'client',
      full_name: data.user.user_metadata?.full_name || ''
    })
  }

  const roleRoutes: Record<string, string> = {
    owner: '/dashboard/owner', admin: '/dashboard/owner',
    content_manager: '/dashboard/team', customer_service: '/dashboard/team',
    employee: '/dashboard/team', client: '/dashboard/client'
  }

  return NextResponse.json({
    success: true,
    role: profile?.wovo_role || 'client',
    redirect: roleRoutes[profile?.wovo_role || 'client'] || '/dashboard/client',
    session: data.session
  })
}
