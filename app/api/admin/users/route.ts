import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data: { users } } = await sb.auth.admin.listUsers()
  const { data: profiles } = await sb.from('profiles').select('*')

  const merged = users.map(u => {
    const profile = profiles?.find(p => p.user_id === u.id)
    return {
      user_id: u.id,
      email: u.email,
      full_name: profile?.full_name || u.user_metadata?.full_name || '',
      wovo_role: profile?.wovo_role || 'client',
      created_at: u.created_at,
      banned: u.banned_until ? true : false,
    }
  })

  return NextResponse.json({ users: merged })
}

export async function PATCH(req: NextRequest) {
  const { userId, email, password, role } = await req.json()
  
  const updates: any = {}
  if (email) updates.email = email
  if (password) updates.password = password

  if (Object.keys(updates).length > 0) {
    const { error } = await sb.auth.admin.updateUserById(userId, updates)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (role) {
    await sb.from('profiles').upsert({ user_id: userId, wovo_role: role })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await req.json()
  
  await sb.from('profiles').delete().eq('user_id', userId)
  await sb.from('clients').delete().eq('profile_id', userId)
  
  const { error } = await sb.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  
  return NextResponse.json({ success: true })
}
