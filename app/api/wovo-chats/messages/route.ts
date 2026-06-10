import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST - save a message
export async function POST(req: NextRequest) {
  const { chatId, role, content, imageUrl, uploadedImgUrl } = await req.json()
  if (!chatId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data, error } = await sb.from('wovo_messages').insert({
    chat_id: chatId,
    role,
    content: content || null,
    image_url: imageUrl || null,
    uploaded_img_url: uploadedImgUrl || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update chat's updated_at and auto-title from first user message
  if (role === 'user' && content) {
    await sb.from('wovo_chats').update({
      updated_at: new Date().toISOString(),
      title: content.slice(0, 40)
    }).eq('id', chatId)
  }

  return NextResponse.json({ message: { ...data, id: data.id } })
}
