import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Look up token
  const { data: record } = await sb
    .from('password_reset_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (!record) return NextResponse.json({ error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 })
  if (record.used_at) return NextResponse.json({ error: 'This reset link has already been used. Please request a new one.' }, { status: 400 })
  if (new Date(record.expires_at) < new Date()) return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })

  // Update password via admin
  const { error } = await sb.auth.admin.updateUserById(record.user_id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Mark token as used
  await sb.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  return NextResponse.json({ success: true })
}
