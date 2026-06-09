import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const cookieStore = await cookies()
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (pairs) => pairs.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        }
      }
    )

    const { data: { session } } = await sb.auth.exchangeCodeForSession(code)

    // Password recovery
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/update-password`)
    }

    if (session?.user) {
      const role = session.user.user_metadata?.wovo_role

      // New OAuth user - create profile
      if (!role) {
        const sbAdmin = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { cookies: { getAll: () => [], setAll: () => {} } }
        )

        const { data: existing } = await sbAdmin.from('profiles')
          .select('wovo_role').eq('user_id', session.user.id).single()

        if (!existing) {
          await sbAdmin.from('profiles').insert({
            user_id: session.user.id,
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
            wovo_role: 'client',
            terms_accepted_at: new Date().toISOString()
          })
          await sbAdmin.from('clients').insert({
            profile_id: session.user.id,
            business_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'My Business',
            owner_name: session.user.user_metadata?.full_name || '',
            email: session.user.email,
            plan: 'free',
            is_active: false,
            source: 'google_oauth'
          })
          return NextResponse.redirect(`${origin}/home`)
        }

        const routes: Record<string, string> = {
          owner: '/admin', admin: '/admin',
          content_manager: '/employee', customer_service: '/employee',
          employee: '/employee', client: '/home'
        }
        return NextResponse.redirect(`${origin}${routes[existing.wovo_role] || '/home'}`)
      }

      const routes: Record<string, string> = {
        owner: '/admin', admin: '/admin',
        content_manager: '/employee', customer_service: '/employee',
        employee: '/employee', client: '/home'
      }
      return NextResponse.redirect(`${origin}${routes[role] || '/home'}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
