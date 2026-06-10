import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET - load all chats + messages for a session/user
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session') || ''
  const userId = req.nextUrl.searchParams.get('user') || null

  let query = sb.from('wovo_chats').select(`
    id, title, created_at, updated_at,
    wovo_messages (id, role, content, image_url, uploaded_img_url, created_at)
  `).order('updated_at', { ascending: false })

  if (userId) {
    query = query.or(`session_id.eq.${sessionId},user_id.eq.${userId}`)
  } else {
    query = query.eq('session_id', sessionId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort messages within each chat
  const chats = (data || []).map((c: any) => ({
    ...c,
    msgs: (c.wovo_messages || []).sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content || '',
      imageUrl: m.image_url || undefined,
      uploadedImg: m.uploaded_img_url || undefined,
    }))
  }))

  return NextResponse.json({ chats })
}

// POST - create new chat
export async function POST(req: NextRequest) {
  const { sessionId, userId, title } = await req.json()
  const { data, error } = await sb.from('wovo_chats').insert({
    session_id: sessionId,
    user_id: userId || null,
    title: title || 'New chat',
    updated_at: new Date().toISOString()
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ chat: { ...data, msgs: [] } })
}

// PATCH - update chat title or link to user
export async function PATCH(req: NextRequest) {
  const { chatId, title, userId, sessionId } = await req.json()
  const updates: any = { updated_at: new Date().toISOString() }
  if (title) updates.title = title
  if (userId) updates.user_id = userId

  const { error } = await sb.from('wovo_chats').update(updates)
    .or(`id.eq.${chatId}`)
    .or(userId ? `user_id.eq.${userId}` : `session_id.eq.${sessionId}`)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE - delete a chat and all its messages
export async function DELETE(req: NextRequest) {
  const { chatId, msgId, sessionId, userId } = await req.json()

  if (msgId) {
    // Delete single message
    const { error } = await sb.from('wovo_messages').delete().eq('id', msgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (chatId) {
    // Verify ownership before deleting
    const { data: chat } = await sb.from('wovo_chats').select('session_id, user_id').eq('id', chatId).single()
    if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (chat.session_id !== sessionId && chat.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    await sb.from('wovo_messages').delete().eq('chat_id', chatId)
    await sb.from('wovo_chats').delete().eq('id', chatId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Missing chatId or msgId' }, { status: 400 })
}
