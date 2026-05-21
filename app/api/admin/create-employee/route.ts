import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { email, password, fullName, role, code } = await req.json()

  const { data, error } = await sb.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await sb.from('profiles').upsert({
    user_id: data.user.id,
    full_name: fullName,
    wovo_role: role,
    employee_code: code
  })

  return NextResponse.json({ userId: data.user.id })
}
